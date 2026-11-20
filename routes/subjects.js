const express = require('express');
const router = express.Router();
// Pull in the model from your master index directory configuration context
const { Subject } = require('../models/index'); 

// 1. GET ALL SUBJECTS (Sorted Sem 1-8, then by Subject Code)
router.get('/', async (req, res) => {
  try {
    const subjects = await Subject.findAll({
      // ✅ CRITICAL FIX: Sorts first by the 'semester' string value, then by your primary key 'id' (subject code)
      order: [
        ['semester', 'ASC'], 
        ['id', 'ASC'] // In your model definition, 'id' maps directly to the `subject code` column
      ]
    });
    res.status(200).json(subjects);
  } catch (err) {
    console.error('Sequelize GET Sorting Error:', err.message);
    res.status(500).json({ message: 'Failed to fetch sorted master subjects list.' });
  }
});

// 2. CREATE A SUBJECT (POST)
router.post('/', async (req, res) => {
  // ✅ UPDATED: Extracted 'type' out of incoming request parameters payload
  const { code, name, batch, semester, department, type } = req.body;
  
  if (!code || !name) {
    return res.status(400).json({ message: 'Subject Code and Name are required fields.' });
  }

  try {
    // We map 'code' from your front-end form directly to 'id' which maps to 'subject code' in the DB
    await Subject.create({
      id: code.trim(), 
      name: name.trim(),
      batch: batch || '1st_year',
      semester: semester || 'Semester 1',
      department: department || 'MCA',
      type: type || 'Theory' // ✅ UPDATED: Stores selection parameter securely inside MySQL
    });

    res.status(200).json({ message: 'Master Subject row inserted successfully!' });
  } catch (err) {
    console.error('Sequelize POST Error:', err.message);
    res.status(500).json({ message: 'Server failed to register the database entry row.' });
  }
});
// 3. UPDATE A SUBJECT (PUT): Modifies layout parameters inline safely
router.get('/history/:subjectId', async (req, res) => {
  // Router contents...
});

router.put('/:id', async (req, res) => {
  // ✅ FIX 2: Decode route parameter containing %2F back into forward slashes
  const targetId = decodeURIComponent(req.params.id); 
  // ✅ UPDATED: Pulling 'type' array parameters bundle securely to handle text modification streams
  const { name, batch, semester, department, code, type } = req.body;

  try {
    // Look up row via Sequelize using primary identity
    const subject = await Subject.findByPk(targetId);
    if (!subject) {
      return res.status(404).json({ message: 'Target subject record entry row was not found.' });
    }

    // Update fields matching your Sequelize properties
    subject.name = name ? name.trim() : subject.name;
    subject.batch = batch || subject.batch;
    subject.semester = semester || subject.semester;
    subject.department = department || subject.department;
    subject.type = type || subject.type; // ✅ UPDATED: Committing active type dropdown structural values inline
    
    // If user edited the Subject Code string itself, handle the mutation safely:
    if (code && code.trim() !== targetId) {
      subject.id = code.trim();
    }

    await subject.save();
    res.status(200).json({ message: 'Subject configuration updated successfully!' });
  } catch (err) {
    console.error('Sequelize PUT Error Context:', err.message);
    res.status(500).json({ message: 'Failed to update database structural layout parameters.' });
  }
});

// 4. DELETE A SUBJECT
router.delete('/:id', async (req, res) => {
  const targetId = req.params.id;

  try {
    const subject = await Subject.findByPk(targetId);
    if (!subject) {
      return res.status(404).json({ message: 'Target subject code entry not found.' });
    }

    await subject.destroy();
    res.status(200).json({ message: 'Row dropped successfully from calendar directory.' });
  } catch (err) {
    console.error('Sequelize DELETE Error:', err.message);
    res.status(500).json({ message: 'Failed to drop selected tracking row.' });
  }
});

module.exports = router;
