const fs = require('fs');
const path = require('path');

// Paths to try
const paths = [
  path.join(__dirname, '..', 'public', 'data', 'sp500.csv'),
  path.join(__dirname, '..', 'dist', 'data', 'sp500.csv'),
  path.join(__dirname, 'data', 'sp500.csv'),
  path.join(process.cwd(), 'public', 'data', 'sp500.csv')
];

// Check each path
paths.forEach(filePath => {
  try {
    console.log(`Checking ${filePath}...`);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const contents = fs.readFileSync(filePath, 'utf8');
      console.log(`✅ FOUND: ${filePath}`);
      console.log(`   Size: ${stats.size} bytes`);
      console.log(`   First few characters: ${contents.substring(0, 50)}...`);
    } else {
      console.log(`❌ NOT FOUND: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ ERROR with ${filePath}:`, error.message);
  }
  console.log('----------------------------');
});

console.log('Complete file check finished.'); 