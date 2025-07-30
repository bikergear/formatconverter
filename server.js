const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use('/processed_images', express.static(path.join(__dirname, 'processed_images')));

const upload = multer({
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Helper functions

function safeDelete(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.error(`Failed to delete file ${filePath}:`, err.message);
    else console.log(`Deleted file: ${filePath}`);
  });
}

function runPythonScript(scriptPath, args, callback) {
  const cmd = `python "${scriptPath}" ${args.map(arg => `"${arg}"`).join(' ')}`;
  exec(cmd, (error, stdout, stderr) => {
    callback(error, stdout, stderr);
  });
}

function buildProcessedImageUrl(req, filename) {
  return `${req.protocol}://${req.get('host')}/processed_images/${filename}`;
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    // A Multer error occurred when uploading
    return res.status(400).send(`Upload failed: ${err.message}`);
  }
  next(err);
});

// Upscale route
app.post('/upscale', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const scaleFactor = parseInt(req.body.scaleFactor, 10);
  if (isNaN(scaleFactor) || scaleFactor < 1) {
    safeDelete(req.file.path);
    return res.status(400).json({ error: 'Invalid scale factor' });
  }

  const inputPath = req.file.path;
  const safeFilename = uuidv4() + '.png';
  const outputDir = path.join(__dirname, 'processed_images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  const outputPath = path.join(outputDir, safeFilename);

  const pythonScriptPath = path.join(__dirname, 'express-python-api', 'upscale.py');

  runPythonScript(pythonScriptPath, [inputPath, outputPath, scaleFactor], (error, stdout, stderr) => {
    // Delete uploaded file ASAP
    safeDelete(inputPath);

    if (error) {
      console.error(`Python script error:\n`, error, '\nSTDERR:', stderr);
      safeDelete(outputPath);
      return res.status(500).json({ error: 'Failed to upscale image' });
    }

    const fullUrl = buildProcessedImageUrl(req, safeFilename);
    return res.status(200).json({ processedImageUrl: fullUrl });
  });
});

// Helper to safely delete files
function safeDelete(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.error(`Failed to delete file ${filePath}:`, err.message);
    else console.log(`Deleted file: ${filePath}`);
  });
}

app.post('/upload', upload.single('image'), (req, res) => {
  const inputPath = req.file.path;
  const safeFilename = uuidv4() + '.png';
  const outputPath = path.join(__dirname, 'processed_images', safeFilename);
  const pythonScriptPath = path.join(__dirname, 'express-python-api', 'removebg.py');

  exec(`python "${pythonScriptPath}" "${inputPath}" "${outputPath}"`, (error, stdout, stderr) => {
    // Delete original upload no matter what
    safeDelete(inputPath);

    if (error) {
      console.error(`Python script error:\n`, error, '\nSTDERR:', stderr);
      safeDelete(outputPath); // delete output if it was somehow created
      return res.status(500).json({ error: 'Failed to process image' });
    }

    const fullUrl = `${req.protocol}://${req.get('host')}/processed_images/${safeFilename}`;
    return res.status(200).json({ processedImageUrl: fullUrl });
  });
});

app.post('/convert', upload.single('image'), (req, res) => {
  const inputPath = req.file.path;
  const outputPath = path.join(__dirname, 'converted', 'output.png');
  const command = `convert "${inputPath}" "${outputPath}"`; // ImageMagick

  exec(command, (error, stdout, stderr) => {
    // Delete original upload ASAP
    safeDelete(inputPath);

    if (error) {
      console.error(`exec error: ${error}`);
      safeDelete(outputPath);
      return res.status(500).json({ error: 'Conversion failed' });
    }

    res.download(outputPath, (err) => {
      if (err) console.error('Download error:', err);
      // Delete converted file after download
      safeDelete(outputPath);
    });
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
