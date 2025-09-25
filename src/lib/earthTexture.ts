import * as THREE from 'three';

// Create a realistic Earth texture programmatically
export function createEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const context = canvas.getContext('2d')!;
  
  // Base ocean color with depth variation
  const oceanGradient = context.createLinearGradient(0, 0, 0, canvas.height);
  oceanGradient.addColorStop(0, '#1e3a8a'); // Deep blue at top
  oceanGradient.addColorStop(0.5, '#2563eb'); // Medium blue at equator
  oceanGradient.addColorStop(1, '#1e3a8a'); // Deep blue at bottom
  context.fillStyle = oceanGradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Accurate continental shapes using actual geographic coordinates
  // Each shape represents major landmasses with proper proportions
  
  // North America
  context.fillStyle = '#166534';
  context.beginPath();
  context.moveTo(0.12 * canvas.width, 0.18 * canvas.height); // Alaska
  context.lineTo(0.18 * canvas.width, 0.15 * canvas.height); // Northern Canada
  context.lineTo(0.25 * canvas.width, 0.20 * canvas.height); // Eastern Canada
  context.lineTo(0.28 * canvas.width, 0.25 * canvas.height); // US East Coast
  context.lineTo(0.32 * canvas.width, 0.35 * canvas.height); // Florida
  context.lineTo(0.28 * canvas.width, 0.40 * canvas.height); // Gulf Coast
  context.lineTo(0.20 * canvas.width, 0.45 * canvas.height); // Mexico
  context.lineTo(0.15 * canvas.width, 0.40 * canvas.height); // West Coast
  context.lineTo(0.10 * canvas.width, 0.25 * canvas.height); // Pacific Coast
  context.closePath();
  context.fill();
  
  // Greenland
  context.beginPath();
  context.ellipse(0.35 * canvas.width, 0.12 * canvas.height, 0.025 * canvas.width, 0.06 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // South America
  context.beginPath();
  context.moveTo(0.28 * canvas.width, 0.50 * canvas.height); // Venezuela
  context.lineTo(0.35 * canvas.width, 0.52 * canvas.height); // Brazil North
  context.lineTo(0.38 * canvas.width, 0.65 * canvas.height); // Brazil East
  context.lineTo(0.35 * canvas.width, 0.80 * canvas.height); // Brazil South
  context.lineTo(0.28 * canvas.width, 0.88 * canvas.height); // Argentina
  context.lineTo(0.25 * canvas.width, 0.85 * canvas.height); // Chile
  context.lineTo(0.22 * canvas.width, 0.70 * canvas.height); // Peru
  context.lineTo(0.25 * canvas.width, 0.55 * canvas.height); // Colombia
  context.closePath();
  context.fill();
  
  // Europe
  context.beginPath();
  context.moveTo(0.45 * canvas.width, 0.20 * canvas.height); // Scandinavia
  context.lineTo(0.55 * canvas.width, 0.18 * canvas.height); // Northern Europe
  context.lineTo(0.58 * canvas.width, 0.25 * canvas.height); // Eastern Europe
  context.lineTo(0.55 * canvas.width, 0.32 * canvas.height); // Balkans
  context.lineTo(0.50 * canvas.width, 0.35 * canvas.height); // Italy
  context.lineTo(0.45 * canvas.width, 0.32 * canvas.height); // France
  context.lineTo(0.42 * canvas.width, 0.28 * canvas.height); // UK area
  context.lineTo(0.45 * canvas.width, 0.22 * canvas.height); // Northern Europe
  context.closePath();
  context.fill();
  
  // Africa
  context.beginPath();
  context.moveTo(0.45 * canvas.width, 0.35 * canvas.height); // North Africa
  context.lineTo(0.58 * canvas.width, 0.33 * canvas.height); // Egypt/Sudan
  context.lineTo(0.62 * canvas.width, 0.45 * canvas.height); // East Africa
  context.lineTo(0.58 * canvas.width, 0.65 * canvas.height); // Central Africa
  context.lineTo(0.52 * canvas.width, 0.78 * canvas.height); // Southern Africa
  context.lineTo(0.45 * canvas.width, 0.75 * canvas.height); // Southwest Africa
  context.lineTo(0.42 * canvas.width, 0.60 * canvas.height); // West Africa
  context.lineTo(0.44 * canvas.width, 0.45 * canvas.height); // Central Africa
  context.closePath();
  context.fill();
  
  // Asia
  context.beginPath();
  context.moveTo(0.58 * canvas.width, 0.15 * canvas.height); // Siberia
  context.lineTo(0.85 * canvas.width, 0.18 * canvas.height); // Eastern Siberia
  context.lineTo(0.90 * canvas.width, 0.25 * canvas.height); // Far East
  context.lineTo(0.88 * canvas.width, 0.35 * canvas.height); // Mongolia
  context.lineTo(0.85 * canvas.width, 0.42 * canvas.height); // China
  context.lineTo(0.78 * canvas.width, 0.48 * canvas.height); // Southeast Asia
  context.lineTo(0.70 * canvas.width, 0.45 * canvas.height); // India
  context.lineTo(0.65 * canvas.width, 0.40 * canvas.height); // Central Asia
  context.lineTo(0.60 * canvas.width, 0.25 * canvas.height); // Western Asia
  context.closePath();
  context.fill();
  
  // India subcontinent
  context.beginPath();
  context.moveTo(0.68 * canvas.width, 0.42 * canvas.height);
  context.lineTo(0.75 * canvas.width, 0.45 * canvas.height);
  context.lineTo(0.73 * canvas.width, 0.55 * canvas.height);
  context.lineTo(0.68 * canvas.width, 0.52 * canvas.height);
  context.closePath();
  context.fill();
  
  // Australia
  context.beginPath();
  context.ellipse(0.82 * canvas.width, 0.70 * canvas.height, 0.06 * canvas.width, 0.04 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // New Zealand
  context.beginPath();
  context.ellipse(0.88 * canvas.width, 0.75 * canvas.height, 0.008 * canvas.width, 0.02 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Japan
  context.beginPath();
  context.ellipse(0.86 * canvas.width, 0.32 * canvas.height, 0.008 * canvas.width, 0.03 * canvas.height, Math.PI/6, 0, Math.PI * 2);
  context.fill();
  
  // UK and Ireland
  context.beginPath();
  context.ellipse(0.42 * canvas.width, 0.28 * canvas.height, 0.012 * canvas.width, 0.02 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Madagascar
  context.beginPath();
  context.ellipse(0.60 * canvas.width, 0.72 * canvas.height, 0.005 * canvas.width, 0.015 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Add vegetation and terrain details
  context.fillStyle = '#22c55e'; // Forest green
  
  // Amazon rainforest
  context.beginPath();
  context.ellipse(0.30 * canvas.width, 0.60 * canvas.height, 0.04 * canvas.width, 0.06 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Congo Basin
  context.beginPath();
  context.ellipse(0.50 * canvas.width, 0.55 * canvas.height, 0.025 * canvas.width, 0.04 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Siberian forests
  context.fillStyle = '#16a34a'; // Darker green for northern forests
  context.beginPath();
  context.ellipse(0.72 * canvas.width, 0.22 * canvas.height, 0.12 * canvas.width, 0.03 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Deserts
  context.fillStyle = '#eab308'; // Desert gold
  
  // Sahara Desert
  context.beginPath();
  context.ellipse(0.50 * canvas.width, 0.40 * canvas.height, 0.08 * canvas.width, 0.03 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Gobi Desert
  context.beginPath();
  context.ellipse(0.78 * canvas.width, 0.35 * canvas.height, 0.04 * canvas.width, 0.02 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Australian Outback
  context.beginPath();
  context.ellipse(0.82 * canvas.width, 0.70 * canvas.height, 0.04 * canvas.width, 0.025 * canvas.height, 0, 0, Math.PI * 2);
  context.fill();
  
  // Mountain ranges
  context.fillStyle = '#78716c'; // Mountain brown
  
  // Himalayas
  context.fillRect(0.68 * canvas.width, 0.40 * canvas.height, 0.08 * canvas.width, 0.015 * canvas.height);
  
  // Andes
  context.fillRect(0.26 * canvas.width, 0.55 * canvas.height, 0.01 * canvas.width, 0.30 * canvas.height);
  
  // Rocky Mountains
  context.fillRect(0.18 * canvas.width, 0.25 * canvas.height, 0.015 * canvas.width, 0.15 * canvas.height);
  
  // Alps
  context.fillRect(0.48 * canvas.width, 0.30 * canvas.height, 0.03 * canvas.width, 0.01 * canvas.height);
  
  // Ice caps with realistic gradients
  const arcticGradient = context.createRadialGradient(
    canvas.width / 2, 0, 0,
    canvas.width / 2, 0, canvas.height * 0.12
  );
  arcticGradient.addColorStop(0, '#ffffff');
  arcticGradient.addColorStop(0.7, '#e0f2fe');
  arcticGradient.addColorStop(1, 'rgba(224, 242, 254, 0)');
  
  context.fillStyle = arcticGradient;
  context.fillRect(0, 0, canvas.width, canvas.height * 0.12);
  
  const antarcticGradient = context.createRadialGradient(
    canvas.width / 2, canvas.height, 0,
    canvas.width / 2, canvas.height, canvas.height * 0.12
  );
  antarcticGradient.addColorStop(0, '#ffffff');
  antarcticGradient.addColorStop(0.7, '#e0f2fe');
  antarcticGradient.addColorStop(1, 'rgba(224, 242, 254, 0)');
  
  context.fillStyle = antarcticGradient;
  context.fillRect(0, canvas.height * 0.88, canvas.width, canvas.height * 0.12);
  
  return new THREE.CanvasTexture(canvas);
}