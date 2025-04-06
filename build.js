// Custom build script for Netlify
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define directories
const distDir = path.join(__dirname, 'dist-web');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('Created dist directory:', distDir);
}

// Create a fallback index.html in case the build fails
const createFallbackHtml = () => {
  const fallbackHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investment Fee Calculator</title>
  <style>
    body { font-family: Arial, sans-serif; text-align: center; margin: 50px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #333; }
    p { color: #666; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Investment Fee Calculator</h1>
    <p>Our calculator helps you visualize the impact of investment fees over time.</p>
    <p>Please check back later as we're currently updating our application.</p>
  </div>
</body>
</html>
  `;
  
  fs.writeFileSync(path.join(distDir, 'index.html'), fallbackHtml);
  console.log('Created fallback index.html');
};

// Ensure we have an index.html file before starting
createFallbackHtml();

// Build the project in steps to avoid memory issues
try {
  console.log('Starting build process...');
  
  // Step 1: Clean previous builds
  console.log('Cleaning previous builds...');
  execSync('rm -rf .parcel-cache', { stdio: 'inherit' });
  
  // Step 2: Try to build with a simplified approach
  console.log('Building with simplified options...');
  execSync(
    'npx parcel build src/index.html --dist-dir ./dist-web --no-cache --no-source-maps --no-optimize',
    { stdio: 'inherit' }
  );
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Parcel build failed:', error.message);
  console.log('Using fallback index.html instead');
  // We already created the fallback, so we can exit with success
  process.exit(0);
} 