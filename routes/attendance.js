const express = require('express');
const router = express.Router();
const { Attendance, User, Subject } = require('../models');
const sequelize = require('../config/db');

// 1. GET BATCH-WISE STUDENT ROSTER (UPDATED: Correctly aggregates multi-hour running logs across columns)
router.get('/students', async (req, res) => {
  try {
    const { batch } = req.query; 

    const searchConditions = { role: 'student' };
    if (batch) {
      searchConditions.batch = batch;
    }

    // Pull students matching criteria
    const rawStudents = await User.findAll({
      where: searchConditions,
      attributes: ['id', 'name', 'username', 'batch'], 
      order: [['username', 'ASC']] 
    });

    // Fetch all records globally to compute running sums dynamically
    const logs = await Attendance.findAll({
      order: [['hour', 'ASC']]
    });

    // Map rows into the exact custom runtime object format your React components expect
    const synchronizedRoster = rawStudents.map(student => {
      const subjectMetricsMap = {};

      // Filter all historical hour logs belonging to this specific student item
      const studentLogs = logs.filter(l => Number(l.studentId || l.student_id) === Number(student.id));

      studentLogs.forEach(log => {
        const subKey = log.subjectId || log.subject_id;
        
        if (!subjectMetricsMap[subKey]) {
          subjectMetricsMap[subKey] = { totalClasses: 0, attended: 0, status: "" };
        }
        
        // FIXED AGGREGATOR: Every unique record row entry increments the totals counter 
        subjectMetricsMap[subKey].totalClasses += 1;
        
        if (log.status === 'Present' || log.status === 'Late') {
          subjectMetricsMap[subKey].attended += 1;
        }
      });

      return {
        id: student.id,
        name: student.name,
        reg: student.username, // maps to student.reg on the frontend
        batch: student.batch,
        subjects: subjectMetricsMap // Injecting updated nested map parameters forces fresh counters to display!
      };
    });

    res.json(synchronizedRoster);
  } catch (err) {
    console.error("Roster Extraction Failure:", err);
    res.status(500).json({ error: err.message });
  }
});

// 2. FIXED UNIFIED COMPATIBILITY HISTORY AGGREGATION ROUTE (With URL Parameter Decoding)
router.get('/history/:subjectId', async (req, res) => {
  // ✅ CRITICAL REFACTOR: Decodes %2F sub-folder elements back into regular forward slashes
  const subjectId = decodeURIComponent(req.params.subjectId);

  try {
    // 1. Fetch ALL historical rows stored in the database for this subject module using Sequelize ORM
    const records = await Attendance.findAll({
      where: { subjectId: subjectId }
    });

    // 2. Fetch all student user mappings to match internal primary integer IDs to register number strings
    const studentsRegistry = await User.findAll({
      where: { role: 'student' },
      attributes: ['id', 'username']
    });

    // Create a fast reference map dictionary matching integer string IDs to string codes
    const idToRegMap = {};
    studentsRegistry.forEach(user => {
      if (user.username) {
        idToRegMap[String(user.id)] = user.username.trim();
      }
    });

    // 3. Aggregate counts per student registration identifier string atomically
    const summariesMatrix = {};

    records.forEach(row => {
      const rawStudentIdStr = String(row.studentId || row.student_id);
      const regNumberStr = idToRegMap[rawStudentIdStr] || rawStudentIdStr;

      const keyLower = regNumberStr.toLowerCase();
      const keyUpper = regNumberStr.toUpperCase();
      const keyId = rawStudentIdStr;

      [keyLower, keyUpper, keyId].forEach(key => {
        if (!summariesMatrix[key]) {
          summariesMatrix[key] = { total: 0, attended: 0 };
        }
      });

      [keyLower, keyUpper, keyId].forEach(key => {
        summariesMatrix[key].total += 1;
        if (row.status === 'Present' || row.status === 'Late') {
          summariesMatrix[key].attended += 1;
        }
      });
    });

    return res.status(200).json(summariesMatrix);
  } catch (err) {
    console.error("Historical Analytics Compilation Failure:", err);
    return res.status(500).json({ message: "Failed to compile running metrics.", error: err.message });
  }
});

// 3. COMMIT BULK DAILY ATTENDANCE (FIXED: Uses individual record upserts to bypass constraint blocking)
router.post('/submit', async (req, res) => {
  try {
    const subjectId = req.body.subjectId || req.body.subject_id;
    const date = req.body.date;
    const hour = req.body.hour || 1; // Safely unpacks the selected dropdown hour parameter
    const records = req.body.records;

    if (!subjectId || !date || !records || !Array.isArray(records)) {
      return res.status(400).json({ 
        error: 'Missing required fields. Ensure subjectId, date, and records array are provided.' 
      });
    }

    // FIXED LOOP STRUCTURE: Iterates using transactionless models upserts to map distinct hour slots cleanly
    for (const rec of records) {
      await Attendance.upsert({
        subjectId: subjectId,
        date: date,                           // Maps correctly to your 'attendance_date' DB column definition layout
        studentId: rec.student_id || rec.studentId, // Gracefully maps both parameter styling structural variants
        status: rec.status,
        hour: parseInt(hour)                  // Explicitly forces separation of hours to allow concurrent entries
      });
    }
    
    res.status(201).json({ message: 'Attendance records successfully committed to MySQL!' });
  } catch (err) {
    console.error("Attendance Submission Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 4. GET INDIVIDUAL STUDENT ATTENDANCE DASHBOARD METRICS (UPDATED: For Real Alphanumeric Subject Codes)
router.get('/student-dashboard/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;

    // ✅ FIXED: Fetch all attendance logs for this student using a raw SQL Join to match actual Subject information
    // This looks up the row whether the record contains the name string OR the generated alphanumeric code.
    const [studentRecords] = await sequelize.query(`
      SELECT 
        a.id,
        a.status,
        a.hour,
        a.attendance_date,
        s.\`subject code\` AS subjectCode,
        s.name AS subjectName
      FROM attendance_records a
      INNER JOIN subjects s ON a.subject_id = s.\`subject code\` OR a.subject_id = s.name
      WHERE a.student_id = ?
      ORDER BY a.attendance_date DESC, a.hour ASC
    `, { replacements: [studentId] });

    const analyticsSummary = {};
    const dateLogsTimeline = {};

    studentRecords.forEach(rec => {
      // ✅ Crucial: Point references directly to your real clean database fields alias
      const subKey = rec.subjectCode; 
      const logDate = rec.attendance_date;
      const currentHour = rec.hour || 1;

      if (!subKey) return;

      // Compile Running Aggregates Metrics
      if (!analyticsSummary[subKey]) {
        analyticsSummary[subKey] = {
          subjectCode: subKey, // Passed to match your frontend bracket parser key expectation smoothly
          subjectName: rec.subjectName,
          totalClasses: 0,
          attendedClasses: 0,
          percentage: "100.0"
        };
      }

      analyticsSummary[subKey].totalClasses += 1;
      if (rec.status === 'Present' || rec.status === 'Late') {
        analyticsSummary[subKey].attendedClasses += 1;
      }

      const total = analyticsSummary[subKey].totalClasses;
      const attended = analyticsSummary[subKey].attendedClasses;
      analyticsSummary[subKey].percentage = ((attended / total) * 100).toFixed(1);

      // Compile Chronological Hourly Timeline Map Breakdown
      if (!dateLogsTimeline[logDate]) {
        dateLogsTimeline[logDate] = {
          date: logDate,
          sessions: []
        };
      }

      dateLogsTimeline[logDate].sessions.push({
        hour: currentHour,
        subjectCode: subKey,
        subjectName: rec.subjectName,
        status: rec.status
      });
    });

    // Return both layers packaged inside a single response object
    return res.status(200).json({
      summaryStats: Object.values(analyticsSummary),
      timelineLogs: Object.values(dateLogsTimeline)
    });
  } catch (err) {
    console.error("Student Dashboard Compilation Failure:", err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
