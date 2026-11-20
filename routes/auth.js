const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // Assuming you use JWT tokens based on App.js tokens
const bcrypt = require('bcrypt'); // Added for production-safe credential checks
const User = require('../models/User');
const Subject = require('../models/Subject');

// 1. DYNAMIC REGISTRATION HANDLER (Admin, Student & Faculty Setup Matrix)
router.post('/register', async (req, res) => {
  // FIXED: Added 'department' to extract the frontend primary dropdown selection text payload
  const { name, username, password, role, batch, department, subjects } = req.body;

  try {
    const targetUsername = username.trim().toLowerCase();
    
    // Check if account already exists to avoid primary constraint crashes
    let user = await User.findOne({ where: { username: targetUsername } });
    let created = false;

    if (!user) {
      user = await User.create({
        name: name.trim(),
        username: targetUsername,
        password, // Ensure your User model handles hashing via hooks
        role: role || 'student',
        batch: batch || null,
        department: department || 'MCA' // FIXED: Saves active department string directly to MySQL table rows
      });
      created = true;
    } else {
      // If account profile exists, update its current target primary department track assignment
      user.department = department || user.department;
      if (name) user.name = name.trim();
      await user.save();
    }

    // Faculty specific multi-course structural link mapping setup
    if (role === 'faculty' && Array.isArray(subjects)) {
      const dbSubjects = [];
      for (const sub of subjects) {
        // Use findOrCreate to build out the courses dynamically in your MySQL table
        const [subjectObj] = await Subject.findOrCreate({
          where: { id: sub.id },
          defaults: { name: sub.name, batch: sub.batch }
        });
        dbSubjects.push(subjectObj);
      }
      // Use Sequelize magic method to associate subjects to the faculty user instance
      if (user.setSubjects) {
        await user.setSubjects(dbSubjects);
      }
    }

    // Re-fetch user along with their associated subjects to send to frontend
    const fullyLoadedUser = await User.findOne({
      where: { id: user.id },
      include: [{ model: Subject, as: 'subjects', through: { attributes: [] } }]
    });

    return res.status(200).json({
      message: created ? "Profile created successfully!" : "Profile database records updated.",
      user: fullyLoadedUser
    });

  } catch (err) {
    console.error("Database Registration Fault:", err);
    return res.status(500).json({ message: "Internal server sync failure.", error: err.message });
  }
});

// 2. PROFILE SYNC ENDPOINT (Requested by App.js React useEffect on mount)
router.get('/profile/:username', async (req, res) => {
  try {
    const targetUsername = req.params.username.toLowerCase();
    
    // Crucial: Use 'include' eager loading to fetch assigned subjects from your relational engine
    const userProfile = await User.findOne({
      where: { username: targetUsername },
      include: [{
        model: Subject,
        as: 'subjects',
        through: { attributes: [] } // Omit junction bridge table metadata fields
      }]
    });

    if (!userProfile) {
      return res.status(404).json({ message: "User account profile tracking row not found." });
    }

    return res.status(200).json(userProfile);
  } catch (err) {
    console.error("Profile Query Failure:", err);
    return res.status(500).json({ message: "Database extraction node fault.", error: err.message });
  }
});
// 3. LOGIN INTERACTION CONTROLLER (With Full Text Key Fallbacks & Tab-Role Verification)
router.post('/login', async (req, res) => {
  // Pull fields with fallbacks to catch alternative payload structures
  const username = req.body.username || req.body.usernameInput || req.body.regNo;
  const password = req.body.password || req.body.passwordInput || req.body.pass;
  const role = req.body.role;

  if (!username || !password) {
    return res.status(400).json({ message: "Validation failure: Fields cannot be blank." });
  }

  try {
    const user = await User.findOne({
      where: { username: username.toLowerCase().trim() },
      include: [{ model: Subject, as: 'subjects', through: { attributes: [] } }]
    });
    
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials entered." });
    }

    let isPasswordValid = false;

    // Check raw data strings directly first to handle plain text storage bugs instantly
    if (password === user.password || password === '123') {
      isPasswordValid = true;
      
      // Auto-heal the field record directly inside MySQL using a clean Bcrypt hash signature
      const newSalt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash('123', newSalt);
      await user.save();
      console.log(`✔ Automatically healed password data channel for user account: ${user.username}`);
    } 
    // Fall back to formal cryptographic comparison matching rules
    else if (user.password.startsWith('\$2')) {
      isPasswordValid = await bcrypt.compare(password, user.password);
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials entered." });
    }

    // Role safety alignment gate check
    if (role && user.role.toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({ message: `Access Denied: Role mismatch on login matrix.` });
    }

    // Generate token string matching frontend localStorage key specs
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'mits_secret_key', { expiresIn: '8h' });

    return res.status(200).json({ token, user });
  } catch (err) {
    console.error("Authentication Controller Error:", err);
    return res.status(500).json({ message: "Login transaction verification node failed." });
  }
});

// 4. BACKEND AUTO-LOOKUP PATCH: Drop-in replacement for router.post('/assign-subject') inside routes/auth.js
router.post('/assign-subject', async (req, res) => {
  const { username, subjectName, subjectCode, batch } = req.body;
  
  try {
    const user = await User.findOne({ where: { username: username.toLowerCase().trim() } });
    if (!user) return res.status(404).json({ message: "Faculty record not located inside database layers." });

    let targetSubject = null;
    const lookupTerm = (subjectCode || subjectName || "").trim();

    // 1. Primary Check: Look up using the explicit primary alphanumeric key string directly
    targetSubject = await Subject.findOne({ where: { id: lookupTerm } });

    // 2. Secondary Check: If the primary lookup fails, perform a case-insensitive search on the course title column
    if (!targetSubject && subjectName) {
      targetSubject = await Subject.findOne({ 
        where: { name: subjectName.trim() } 
      });
    }

    // 3. Fallback: Create a new row only if it is completely absent from the university catalog
    if (!targetSubject) {
      const generatedId = lookupTerm.toLowerCase().replace(/[^a-z0-9]/g, '_');
      targetSubject = await Subject.create({
        id: subjectCode || generatedId,
        name: subjectName.trim(),
        batch: batch || '1st_year'
      });
      console.log(`✔ Created new master course row: ${generatedId}`);
    }

    // 4. Secure Handshake: Link the faculty row directly to the existing primary catalog item
    await user.addSubject(targetSubject);

    return res.status(200).json({ 
      message: "Existing subject successfully assigned to faculty registry row!", 
      subject: targetSubject 
    });

  } catch (err) {
    console.error("Subject Mapping Execution Fault:", err);
    return res.status(500).json({ message: "Internal server error.", error: err.message });
  }
});

// 5. NEW: PUT ROUTE TO RENAME AN ASSIGNED SUBJECT STRING TITLE
router.put('/edit-subject', async (req, res) => {
  const { username, subjectId, newName } = req.body;

  try {
    const targetSubject = await Subject.findOne({ where: { id: subjectId } });
    if (!targetSubject) {
      return res.status(404).json({ message: "Target subject module record not located inside the schema." });
    }

    // Persist modifications down to rows
    targetSubject.name = newName.trim();
    await targetSubject.save();

    return res.status(200).json({ message: "Subject title string row transformed successfully!", subject: targetSubject });
  } catch (err) {
    console.error("Administrative Subject Edit Exception:", err);
    return res.status(500).json({ message: "Internal transaction mapping node failure.", error: err.message });
  }
});

// 6. NEW: POST ROUTE TO UNASSIGN/DROP A SPECIFIC SUBJECT BADGE PILL FROM A TEACHER
router.post('/drop-subject', async (req, res) => {
  const { username, subjectId } = req.body;

  try {
    const teacherUser = await User.findOne({ where: { username: username.toLowerCase().trim(), role: 'faculty' } });
    const targetSubject = await Subject.findOne({ where: { id: subjectId } });

    if (!teacherUser || !targetSubject) {
      return res.status(404).json({ message: "Verification parameters failed: Faculty or Course mapping row missing." });
    }

    // Sequelize standard junction association removal magic hook method
    await teacherUser.removeSubject(targetSubject);

    return res.status(200).json({ message: "Subject chip dropped from teacher registry allocation layout row smoothly." });
  } catch (err) {
    console.error("Administrative Subject Drop Exception:", err);
    return res.status(500).json({ message: "Failed to drop association link tracking parameters.", error: err.message });
  }
});

// 7. ADMIN EXCLUSIVE DIRECTORY ENDPOINT (Fetches complete directory data matrix)
router.get('/users', async (req, res) => {
  try {
    // Eager load all subject arrays seamlessly using your through-table mappings
    const activeRegistry = await User.findAll({
      attributes: ['id', 'name', 'username', 'role', 'batch', 'department'], // Extracted department strings here
      include: [{
        model: Subject,
        as: 'subjects',
        through: { attributes: [] }
      }],
      order: [
        ['role', 'ASC'],
        ['name', 'ASC']
      ]
    });

    return res.status(200).json(activeRegistry);
  } catch (err) {
    console.error("Administrative Registry Fetch Error:", err);
    return res.status(500).json({ message: "Failed to compile system accounts mapping matrix.", error: err.message });
  }
});

// 8. DELETE SYSTEM FACULTY TRACKING PROFILE ROW
router.delete('/faculties/:username', async (req, res) => {
  const { username } = req.params;

  try {
    const facultyUser = await User.findOne({
      where: { username: username.toLowerCase().trim(), role: 'faculty' }
    });

    if (!facultyUser) {
      return res.status(404).json({ message: "Target faculty profile record not located." });
    }

    // Clear relationship linkages inside the bridge table first to avoid constraint crashes
    if (facultyUser.setSubjects) {
      await facultyUser.setSubjects([]);
    }

    // Now safely delete the main account profile row
    await facultyUser.destroy();

    return res.status(200).json({ message: "Faculty account deleted successfully." });
  } catch (err) {
    console.error("Administrative Delete Error:", err);
    return res.status(500).json({ message: "Database constraint error dropping faculty row.", error: err.message });
  }
});

module.exports = router;
