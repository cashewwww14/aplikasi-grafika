// Folding Doors - 4 Panel Realistic Animation
// WebGL Implementation

var canvas;
var gl;
var program;

var vBuffer, cBuffer, nBuffer, iBuffer, tBuffer;
var modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;
var modelViewMatrix = mat4();
var projectionMatrix;

// Camera settings
var eye = vec3(8, 4, 8);
var at = vec3(0, 2, 0);
var up = vec3(0, 1, 0);

var mouseDown = false;
var lastMouseX = 0;
var lastMouseY = 0;
var cameraRotation = { x: 20, y: 45 };
var zoom = 8;

// Door animation variables - Hierarchical panel control
var panel1Angle = 0; // Panel 1 rotation
var panel2Angle = 0; // Panel 2 rotation (relative to Panel 1)
var panel3Angle = 0; // Panel 3 rotation (relative to Panel 2)
var panel4Angle = 0; // Panel 4 rotation (relative to Panel 3)

var isOpening = false;
var isClosing = false;
var isFolding = false;
var animationSpeed = 1.5; // degrees per frame
var MAX_PANEL_ANGLE = 90; // Maximum angle for panels

// Visual options
var wireframe = false;

// Geometry data
var vertices = [];
var colors = [];
var normals = [];
var indices = [];
var texCoords = [];

// Lighting variables
var lightingEnabled = true;
var ambientColor = vec3(0.2, 0.2, 0.2);
var diffuseColor = vec3(1.0, 1.0, 1.0);
var specularColor = vec3(1.0, 1.0, 1.0);
var lightPosition = vec3(3.0, 5.0, 3.0);
var shininess = 50.0;

var ambientLightLoc, diffuseLightLoc, specularLightLoc;
var lightPositionLoc, shininessLoc, enableLightingLoc;

// Texture variables
var doorTexture;
var useTexture = true;
var textureLoc, useTextureLoc;

// Door dimensions (realistic proportions)
var DOOR_WIDTH = 0.8;    // Width of each panel
var DOOR_HEIGHT = 2.8;   // Height of door
var DOOR_THICKNESS = 0.05; // Thickness of door panel
var FRAME_WIDTH = 0.08;  // Width of wooden frame
var HORIZONTAL_BAR_HEIGHT = 0.12; // Height of horizontal bar in middle
var PANEL_GAP = 0.02;    // Small gap between panels (CELAH KECIL!)
var HINGE_RADIUS = 0.06; // Hinge cylinder radius
var HINGE_HEIGHT = 0.18; // Hinge cylinder height
var LEG_RADIUS = 0.04;   // Leg cylinder radius (KAKI PINTU!)
var LEG_HEIGHT = 0.18;   // Leg height extending downward (shortened)

// HIERARCHICAL TRANSFORMATION SYSTEM - Like Huawei Mate X folding phone!
// 
// Panel 1 (leftmost): Right edge connects to Panel 2 via hinge
// Panel 2: Left edge at Panel 1's right, right edge connects to Panel 3
// Panel 3: Left edge at Panel 2's right, right edge connects to Panel 4  
// Panel 4 (rightmost): Left edge at Panel 3's right
//
// Each panel INHERITS parent's transformation → panels stay connected!

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.78, 0.82, 0.85, 1.0); // Light silver/gray background
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    // Create geometry
    createFoldingDoors();

    // Initialize shaders
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Setup buffers
    setupBuffers();

    // Get uniform locations
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");
    
    // Lighting uniforms
    ambientLightLoc = gl.getUniformLocation(program, "ambientLight");
    diffuseLightLoc = gl.getUniformLocation(program, "diffuseLight");
    specularLightLoc = gl.getUniformLocation(program, "specularLight");
    lightPositionLoc = gl.getUniformLocation(program, "lightPosition");
    shininessLoc = gl.getUniformLocation(program, "shininess");
    enableLightingLoc = gl.getUniformLocation(program, "enableLighting");
    
    // Texture uniforms
    textureLoc = gl.getUniformLocation(program, "uTexture");
    useTextureLoc = gl.getUniformLocation(program, "useTexture");

    // Initialize projection
    updateProjectionMatrix();
    
    // Load texture
    loadDoorTexture();

    // Setup event listeners
    setupEventListeners();
    setupControlListeners();

    // Start render loop
    render();
};

function loadDoorTexture() {
    doorTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, doorTexture);
    
    // Create a placeholder texture while loading
    var placeholder = new Uint8Array([139, 90, 43, 255]); // Brown color
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
    
    // Load actual image
    var image = new Image();
    image.onload = function() {
        gl.bindTexture(gl.TEXTURE_2D, doorTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        
        // Check if image is power of 2
        if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
            gl.generateMipmap(gl.TEXTURE_2D);
        } else {
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    
    image.onerror = function() {
        console.log("Failed to load door texture, using wood pattern");
        createWoodTexture();
    };
    
    image.src = "door-texture.jpg";
}

function createWoodTexture() {
    gl.bindTexture(gl.TEXTURE_2D, doorTexture);
    
    var size = 256;
    var data = new Uint8Array(size * size * 4);
    
    // Create wood-like pattern
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            var idx = (i * size + j) * 4;
            var wood = Math.sin(j * 0.1) * 20 + 139;
            data[idx] = wood;     // R
            data[idx + 1] = wood * 0.6; // G
            data[idx + 2] = wood * 0.3; // B
            data[idx + 3] = 255;  // A
        }
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

function createFoldingDoors() {
    vertices = [];
    colors = [];
    normals = [];
    indices = [];
    texCoords = [];
    
    var panelColor = vec4(0.55, 0.35, 0.2, 1.0); // Wood brown
    var frameColor = vec4(0.98, 0.94, 0.85, 1.0); // Cream color (same as legs/hinges)
    
    // HIERARCHICAL TRANSFORMATION SYSTEM
    // SIMPLE & CORRECT: Each panel pivots at LEFT edge, next panel attaches to RIGHT edge
    // WITH GAPS: Small gap between each connected panel
    
    // PANEL 1: Starting position
    var transform1 = mat4();
    transform1 = mult(transform1, translate(-2.0, DOOR_HEIGHT/2, 0)); // Wall position
    transform1 = mult(transform1, rotateY(panel1Angle)); // Rotate around left edge (at wall)
    
    // PANEL 2: Attached to Panel 1's right edge + GAP
    var transform2 = mult(transform1, translate(DOOR_WIDTH + PANEL_GAP, 0, 0)); // Move to Panel 1's right + gap
    transform2 = mult(transform2, rotateY(panel2Angle)); // Rotate around this point
    
    // HINGE 1-2: Between panel 1 and 2
    var hinge12Transform = mult(transform1, translate(DOOR_WIDTH, 0, 0)); // At connection point
    
    // PANEL 3: Attached to Panel 2's right edge + GAP
    var transform3 = mult(transform2, translate(DOOR_WIDTH + PANEL_GAP, 0, 0)); // Move to Panel 2's right + gap
    transform3 = mult(transform3, rotateY(panel3Angle)); // Rotate around this point
    
    // HINGE 2-3: Between panel 2 and 3
    var hinge23Transform = mult(transform2, translate(DOOR_WIDTH, 0, 0));
    
    // PANEL 4: Attached to Panel 3's right edge + GAP
    var transform4 = mult(transform3, translate(DOOR_WIDTH + PANEL_GAP, 0, 0)); // Move to Panel 3's right + gap
    transform4 = mult(transform4, rotateY(panel4Angle)); // Rotate around this point
    
    // HINGE 3-4: Between panel 3 and 4
    var hinge34Transform = mult(transform3, translate(DOOR_WIDTH, 0, 0));
    
    // Create all panels with their respective transformations
    createDoorPanel(transform1, panelColor, frameColor);
    createDoorPanel(transform2, panelColor, frameColor);
    createDoorPanel(transform3, panelColor, frameColor);
    createDoorPanel(transform4, panelColor, frameColor);
    
    // Create hinges (2 per connection: at 2/5 and 4/5 height)
    var hingeColor = vec4(0.98, 0.94, 0.85, 1.0); // Cream color
    createHinges(hinge12Transform, hingeColor);
    createHinges(hinge23Transform, hingeColor);
    createHinges(hinge34Transform, hingeColor);
    
    // Create legs (KAKI) at bottom of each panel - 2 legs: LEFT and RIGHT edges
    var legColor = vec4(0.98, 0.94, 0.85, 1.0); // Cream color (same as hinges)
    createLegs(transform1, legColor);
    createLegs(transform2, legColor);
    createLegs(transform3, legColor);
    createLegs(transform4, legColor);
}

function createDoorPanel(panelTransform, panelColor, frameColor) {
    var startIndex = vertices.length;
    
    // Main door panel (center filled area)
    var panelVertices = [];
    var panelColors = [];
    var panelNormals = [];
    var panelTexCoords = [];
    
    var w = DOOR_WIDTH;
    var h = DOOR_HEIGHT;
    var t = DOOR_THICKNESS;
    var f = FRAME_WIDTH; // frame width
    var bh = HORIZONTAL_BAR_HEIGHT; // bar height
    
    // IMPORTANT: Panel geometry goes from 0 to w (left edge at origin)
    // This way rotation pivot is at left edge (x=0)
    
    // Create door structure with CYLINDRICAL frames
    var frameRadius = f / 2; // radius for cylinder frame
    var barGap = frameRadius * 1.8; // Gap between the two cylinders
    var barRadius = frameRadius * 0.65;
    
    // Slightly darker color for the box between cylinders
    var boxColor = vec4(0.96, 0.92, 0.83, 1.0); // Sedikit lebih gelap dari cream
    
    // Bottom frame (TWO parallel cylinders - NO box between)
    // Bottom upper cylinder
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, -h/2 + barGap/2, w, barRadius, frameColor, true);
    // Bottom lower cylinder
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, -h/2 - barGap/2, w, barRadius, frameColor, true);
    
    // Top frame (TWO parallel cylinders - NO box between)
    // Top upper cylinder
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, h/2 + barGap/2, w, barRadius, frameColor, true);
    // Top lower cylinder
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, h/2 - barGap/2, w, barRadius, frameColor, true);
    
    // Left frame (vertical cylinder)
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, -h/2, h, frameRadius, frameColor, false);
    
    // Right frame (vertical cylinder)
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        w, -h/2, h, frameRadius, frameColor, false);
    
    // Middle horizontal bars (TWO parallel cylinders - NO box between)
    // Top bar of middle section
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, barGap/2, w, barRadius, frameColor, true);
    // Bottom bar of middle section
    createFrameCylinder(panelVertices, panelNormals, panelTexCoords, panelColors,
                        0, -barGap/2, w, barRadius, frameColor, true);
    
    // Define 3 colors: cream (sides) and dark brown (center)
    var creamColor = vec4(0.85, 0.75, 0.60, 1.0); // Krem terang
    var darkBrownColor = vec4(0.35, 0.25, 0.15, 1.0); // Coklat gelap
    
    // Calculate widths for 3 sections - FULLY EXTEND to frame edges (no gaps)
    var innerWidth = w; // Full width - no gaps
    var sectionWidth = innerWidth / 3;
    var startX = 0; // Start from very edge
    
    // TOP PANEL - 3 sections (krem, coklat, krem) - extend fully to cylinders
    var topHeight = h/2 - (barGap/2 + barRadius);
    var topStart = barGap/2 + barRadius;
    
    // Top Left section (cream)
    createPanelFill(panelVertices, panelNormals, panelTexCoords, panelColors,
                   startX, topStart, sectionWidth, topHeight, t, creamColor);
    
    // Top Center section (dark brown)
    createPanelFill(panelVertices, panelNormals, panelTexCoords, panelColors,
                   startX + sectionWidth, topStart, sectionWidth, topHeight, t, darkBrownColor);
    
    // Top Right section (cream)
    createPanelFill(panelVertices, panelNormals, panelTexCoords, panelColors,
                   startX + 2*sectionWidth, topStart, sectionWidth, topHeight, t, creamColor);
    
    // BOTTOM PANEL - 3 sections (krem, coklat, krem) - extend fully to cylinders
    var bottomHeight = (-barGap/2 - barRadius) - (-h/2);
    var bottomStart = -h/2;
    
    // Bottom Left section (cream)
    createPanelFill(panelVertices, panelNormals, panelTexCoords, panelColors,
                   startX, bottomStart, sectionWidth, bottomHeight, t, creamColor);
    
    // Bottom Center section (dark brown)
    createPanelFill(panelVertices, panelNormals, panelTexCoords, panelColors,
                   startX + sectionWidth, bottomStart, sectionWidth, bottomHeight, t, darkBrownColor);
    
    // Bottom Right section (cream)
    createPanelFill(panelVertices, panelNormals, panelTexCoords, panelColors,
                   startX + 2*sectionWidth, bottomStart, sectionWidth, bottomHeight, t, creamColor);
    
    // Transform all vertices by the panel transformation
    for (var i = 0; i < panelVertices.length; i++) {
        var transformed = mult(panelTransform, panelVertices[i]);
        vertices.push(transformed);
        colors.push(panelColors[i]);
        
        // Transform normals
        var normalMat = mat3();
        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
                normalMat[r][c] = panelTransform[r][c];
            }
        }
        var transformedNormal = mult(normalMat, panelNormals[i]);
        normals.push(normalize(transformedNormal));
        texCoords.push(panelTexCoords[i]);
    }
}

function createFrameRect(verts, norms, texCoords, colors, x, y, width, height, thickness, color) {
    var startIdx = verts.length;
    
    // Create a box for the frame
    var w2 = width / 2;
    var h2 = height / 2;
    var t2 = thickness / 2;
    var cx = x + width / 2;
    var cy = y + height / 2;
    
    // 8 vertices of the box
    var v = [
        vec4(cx - w2, cy - h2, t2, 1.0),  // 0: front-bottom-left
        vec4(cx + w2, cy - h2, t2, 1.0),  // 1: front-bottom-right
        vec4(cx + w2, cy + h2, t2, 1.0),  // 2: front-top-right
        vec4(cx - w2, cy + h2, t2, 1.0),  // 3: front-top-left
        vec4(cx - w2, cy - h2, -t2, 1.0), // 4: back-bottom-left
        vec4(cx + w2, cy - h2, -t2, 1.0), // 5: back-bottom-right
        vec4(cx + w2, cy + h2, -t2, 1.0), // 6: back-top-right
        vec4(cx - w2, cy + h2, -t2, 1.0)  // 7: back-top-left
    ];
    
    // Front face
    addQuad(verts, norms, texCoords, colors, v[0], v[1], v[2], v[3], vec3(0, 0, 1), color);
    // Back face
    addQuad(verts, norms, texCoords, colors, v[5], v[4], v[7], v[6], vec3(0, 0, -1), color);
    // Top face
    addQuad(verts, norms, texCoords, colors, v[3], v[2], v[6], v[7], vec3(0, 1, 0), color);
    // Bottom face
    addQuad(verts, norms, texCoords, colors, v[4], v[5], v[1], v[0], vec3(0, -1, 0), color);
    // Right face
    addQuad(verts, norms, texCoords, colors, v[1], v[5], v[6], v[2], vec3(1, 0, 0), color);
    // Left face
    addQuad(verts, norms, texCoords, colors, v[4], v[0], v[3], v[7], vec3(-1, 0, 0), color);
}

function createPanelFill(verts, norms, texCoords, colors, x, y, width, height, thickness, color) {
    // Similar to frame but represents the woven/textured center panel
    createFrameRect(verts, norms, texCoords, colors, x, y, width, height, thickness * 0.8, color);
}

function addQuad(verts, norms, texCoords, colors, v1, v2, v3, v4, normal, color) {
    // Add 4 vertices for a quad (will be split into 2 triangles during indexing)
    verts.push(v1, v2, v3, v4);
    
    // Add normals
    for (var i = 0; i < 4; i++) {
        norms.push(normal);
        colors.push(color);
    }
    
    // Add texture coordinates with proper mapping for realistic texture
    texCoords.push(
        vec2(0, 0),
        vec2(1, 0),
        vec2(1, 1),
        vec2(0, 1)
    );
}

// Create cylindrical frame with caps (like legs)
function createFrameCylinder(verts, norms, texCoordArray, colorArray, xStart, yStart, length, radius, color, isHorizontal) {
    var segments = 16;
    
    for (var i = 0; i < segments; i++) {
        var angle1 = (i / segments) * 2 * Math.PI;
        var angle2 = ((i + 1) / segments) * 2 * Math.PI;
        
        var cos1 = Math.cos(angle1);
        var sin1 = Math.sin(angle1);
        var cos2 = Math.cos(angle2);
        var sin2 = Math.sin(angle2);
        
        if (isHorizontal) {
            // Horizontal cylinder (along X axis) - side surface
            var v1 = vec4(xStart, yStart + radius * cos1, radius * sin1, 1.0);
            var v2 = vec4(xStart + length, yStart + radius * cos1, radius * sin1, 1.0);
            var v3 = vec4(xStart + length, yStart + radius * cos2, radius * sin2, 1.0);
            var v4 = vec4(xStart, yStart + radius * cos2, radius * sin2, 1.0);
            
            var normal = normalize(vec3(0, (cos1 + cos2) / 2, (sin1 + sin2) / 2));
            
            addQuad(verts, norms, texCoordArray, colorArray, v1, v2, v3, v4, normal, color);
        } else {
            // Vertical cylinder (along Y axis) - side surface
            var v1 = vec4(xStart + radius * cos1, yStart, radius * sin1, 1.0);
            var v2 = vec4(xStart + radius * cos1, yStart + length, radius * sin1, 1.0);
            var v3 = vec4(xStart + radius * cos2, yStart + length, radius * sin2, 1.0);
            var v4 = vec4(xStart + radius * cos2, yStart, radius * sin2, 1.0);
            
            var normal = normalize(vec3((cos1 + cos2) / 2, 0, (sin1 + sin2) / 2));
            
            addQuad(verts, norms, texCoordArray, colorArray, v1, v2, v3, v4, normal, color);
        }
    }
    
    // Add caps (end pieces)
    if (isHorizontal) {
        // Left cap (at xStart)
        var centerLeft = vec4(xStart, yStart, 0, 1.0);
        for (var i = 0; i < segments; i++) {
            var angle1 = (i / segments) * 2 * Math.PI;
            var angle2 = ((i + 1) / segments) * 2 * Math.PI;
            
            var v1 = centerLeft;
            var v2 = vec4(xStart, yStart + radius * Math.cos(angle1), radius * Math.sin(angle1), 1.0);
            var v3 = vec4(xStart, yStart + radius * Math.cos(angle2), radius * Math.sin(angle2), 1.0);
            
            addTriangle(verts, norms, texCoordArray, colorArray, v1, v2, v3, vec3(-1, 0, 0), color);
        }
        
        // Right cap (at xStart + length)
        var centerRight = vec4(xStart + length, yStart, 0, 1.0);
        for (var i = 0; i < segments; i++) {
            var angle1 = (i / segments) * 2 * Math.PI;
            var angle2 = ((i + 1) / segments) * 2 * Math.PI;
            
            var v1 = centerRight;
            var v2 = vec4(xStart + length, yStart + radius * Math.cos(angle2), radius * Math.sin(angle2), 1.0);
            var v3 = vec4(xStart + length, yStart + radius * Math.cos(angle1), radius * Math.sin(angle1), 1.0);
            
            addTriangle(verts, norms, texCoordArray, colorArray, v1, v2, v3, vec3(1, 0, 0), color);
        }
    } else {
        // Bottom cap (at yStart)
        var centerBottom = vec4(xStart, yStart, 0, 1.0);
        for (var i = 0; i < segments; i++) {
            var angle1 = (i / segments) * 2 * Math.PI;
            var angle2 = ((i + 1) / segments) * 2 * Math.PI;
            
            var v1 = centerBottom;
            var v2 = vec4(xStart + radius * Math.cos(angle1), yStart, radius * Math.sin(angle1), 1.0);
            var v3 = vec4(xStart + radius * Math.cos(angle2), yStart, radius * Math.sin(angle2), 1.0);
            
            addTriangle(verts, norms, texCoordArray, colorArray, v1, v2, v3, vec3(0, -1, 0), color);
        }
        
        // Top cap (at yStart + length)
        var centerTop = vec4(xStart, yStart + length, 0, 1.0);
        for (var i = 0; i < segments; i++) {
            var angle1 = (i / segments) * 2 * Math.PI;
            var angle2 = ((i + 1) / segments) * 2 * Math.PI;
            
            var v1 = centerTop;
            var v2 = vec4(xStart + radius * Math.cos(angle2), yStart + length, radius * Math.sin(angle2), 1.0);
            var v3 = vec4(xStart + radius * Math.cos(angle1), yStart + length, radius * Math.sin(angle1), 1.0);
            
            addTriangle(verts, norms, texCoordArray, colorArray, v1, v2, v3, vec3(0, 1, 0), color);
        }
    }
}

// Helper function to add triangle
function addTriangle(verts, norms, texCoordArray, colorArray, v1, v2, v3, normal, color) {
    verts.push(v1, v2, v3);
    norms.push(normal, normal, normal);
    colorArray.push(color, color, color);
    texCoordArray.push(vec2(0, 0), vec2(1, 0), vec2(0.5, 1));
}

// Create 2 hinges at 2/5 and 4/5 height
function createHinges(hingeTransform, hingeColor) {
    var h = DOOR_HEIGHT;
    
    // Hinge 1: at 2/5 height
    var hinge1Y = -h/2 + (2/5) * h;
    createHinge(hingeTransform, hinge1Y, hingeColor);
    
    // Hinge 2: at 4/5 height
    var hinge2Y = -h/2 + (4/5) * h;
    createHinge(hingeTransform, hinge2Y, hingeColor);
}

function createHinge(hingeTransform, yPos, color) {
    var localVerts = [];
    var localNorms = [];
    var localTexCoords = [];
    var localColors = [];
    
    var r = HINGE_RADIUS;
    var h = HINGE_HEIGHT;
    var segments = 12;
    
    // Create cylinder for hinge
    for (var i = 0; i < segments; i++) {
        var angle1 = (i / segments) * 2 * Math.PI;
        var angle2 = ((i + 1) / segments) * 2 * Math.PI;
        
        var x1 = r * Math.cos(angle1);
        var z1 = r * Math.sin(angle1);
        var x2 = r * Math.cos(angle2);
        var z2 = r * Math.sin(angle2);
        
        // Side face
        var v1 = vec4(x1, yPos - h/2, z1, 1.0);
        var v2 = vec4(x2, yPos - h/2, z2, 1.0);
        var v3 = vec4(x2, yPos + h/2, z2, 1.0);
        var v4 = vec4(x1, yPos + h/2, z1, 1.0);
        
        var normal = vec3((x1+x2)/2, 0, (z1+z2)/2);
        normal = normalize(normal);
        
        addQuad(localVerts, localNorms, localTexCoords, localColors, v1, v2, v3, v4, normal, color);
    }
    
    // Transform and add to main arrays
    for (var i = 0; i < localVerts.length; i++) {
        var transformed = mult(hingeTransform, localVerts[i]);
        vertices.push(transformed);
        colors.push(localColors[i]);
        
        // Transform normals
        var normalMat = mat3();
        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
                normalMat[r][c] = hingeTransform[r][c];
            }
        }
        var transformedNormal = mult(normalMat, localNorms[i]);
        normals.push(normalize(transformedNormal));
        texCoords.push(localTexCoords[i]);
    }
}

// Create 2 legs (KAKI) at bottom of panel - LEFT and RIGHT edges
function createLegs(panelTransform, color) {
    // Left leg (at left edge)
    createLeg(panelTransform, color, 0.1); // x = 0.1 (near left edge)
    
    // Right leg (at right edge)
    createLeg(panelTransform, color, DOOR_WIDTH - 0.1); // x = near right edge
}

// Create single leg (KAKI) cylinder extending downward
function createLeg(panelTransform, color, xPos) {
    var localVerts = [];
    var localNorms = [];
    var localTexCoords = [];
    var localColors = [];
    
    var r = LEG_RADIUS;
    var h = LEG_HEIGHT;
    var yBottom = -DOOR_HEIGHT / 2; // Bottom of door
    var segments = 16;
    
    // Create cylinder for leg extending DOWNWARD from bottom
    for (var i = 0; i < segments; i++) {
        var angle1 = (i / segments) * 2 * Math.PI;
        var angle2 = ((i + 1) / segments) * 2 * Math.PI;
        
        var x1 = r * Math.cos(angle1);
        var z1 = r * Math.sin(angle1);
        var x2 = r * Math.cos(angle2);
        var z2 = r * Math.sin(angle2);
        
        // Side face - extends DOWNWARD
        var v1 = vec4(xPos + x1, yBottom, z1, 1.0);           // Top of leg (at door bottom)
        var v2 = vec4(xPos + x2, yBottom, z2, 1.0);           // Top of leg
        var v3 = vec4(xPos + x2, yBottom - h, z2, 1.0);       // Bottom of leg (extends down)
        var v4 = vec4(xPos + x1, yBottom - h, z1, 1.0);       // Bottom of leg
        
        var normal = vec3((x1+x2)/2, 0, (z1+z2)/2);
        normal = normalize(normal);
        
        addQuad(localVerts, localNorms, localTexCoords, localColors, v1, v2, v3, v4, normal, color);
    }
    
    // Bottom cap of leg
    var center = vec4(xPos, yBottom - h, 0, 1.0);
    for (var i = 0; i < segments; i++) {
        var angle1 = (i / segments) * 2 * Math.PI;
        var angle2 = ((i + 1) / segments) * 2 * Math.PI;
        
        var x1 = r * Math.cos(angle1);
        var z1 = r * Math.sin(angle1);
        var x2 = r * Math.cos(angle2);
        var z2 = r * Math.sin(angle2);
        
        var v1 = center;
        var v2 = vec4(xPos + x1, yBottom - h, z1, 1.0);
        var v3 = vec4(xPos + x2, yBottom - h, z2, 1.0);
        var v4 = center;
        
        addQuad(localVerts, localNorms, localTexCoords, localColors, v1, v2, v3, v4, vec3(0, -1, 0), color);
    }
    
    // Transform and add to main arrays
    for (var i = 0; i < localVerts.length; i++) {
        var transformed = mult(panelTransform, localVerts[i]);
        vertices.push(transformed);
        colors.push(localColors[i]);
        
        // Transform normals
        var normalMat = mat3();
        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
                normalMat[r][c] = panelTransform[r][c];
            }
        }
        var transformedNormal = mult(normalMat, localNorms[i]);
        normals.push(normalize(transformedNormal));
        texCoords.push(localTexCoords[i]);
    }
}

function createFloor() {
    var floorSize = 15;
    var floorColor = vec4(0.6, 0.6, 0.6, 1.0);
    var startIndex = vertices.length;
    
    // Floor vertices
    vertices.push(
        vec4(-floorSize, 0, -floorSize, 1.0),
        vec4(floorSize, 0, -floorSize, 1.0),
        vec4(floorSize, 0, floorSize, 1.0),
        vec4(-floorSize, 0, floorSize, 1.0)
    );
    
    // Floor normals
    for (var i = 0; i < 4; i++) {
        colors.push(floorColor);
        normals.push(vec3(0, 1, 0));
        texCoords.push(vec2(0, 0));
    }
    
    // Floor indices
    indices.push(startIndex, startIndex + 1, startIndex + 2);
    indices.push(startIndex, startIndex + 2, startIndex + 3);
}

function createWall() {
    var wallColor = vec4(0.8, 0.8, 0.75, 1.0);
    var startIndex = vertices.length;
    
    // Back wall
    vertices.push(
        vec4(-10, 0, -5, 1.0),
        vec4(10, 0, -5, 1.0),
        vec4(10, 5, -5, 1.0),
        vec4(-10, 5, -5, 1.0)
    );
    
    for (var i = 0; i < 4; i++) {
        colors.push(wallColor);
        normals.push(vec3(0, 0, 1));
        texCoords.push(vec2(0, 0));
    }
    
    indices.push(startIndex, startIndex + 1, startIndex + 2);
    indices.push(startIndex, startIndex + 2, startIndex + 3);
}

function setupBuffers() {
    // Position buffer
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    // Color buffer
    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);
    
    // Normal buffer
    nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    
    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);
    
    // Texture coordinate buffer
    tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);
    
    var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoord);
    
    // Index buffer
    iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

function updateBuffers() {
    createFoldingDoors();
    
    // Generate indices for all quads
    indices = [];
    var quadCount = vertices.length / 4;
    for (var i = 0; i < quadCount; i++) {
        var base = i * 4;
        indices.push(base, base + 1, base + 2);
        indices.push(base, base + 2, base + 3);
    }
    
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

function updateProjectionMatrix() {
    projectionMatrix = perspective(45, canvas.width/canvas.height, 0.1, 100);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
}

function setupEventListeners() {
    canvas.addEventListener("mousedown", function(event) {
        mouseDown = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });
    
    canvas.addEventListener("mouseup", function() {
        mouseDown = false;
    });
    
    canvas.addEventListener("mousemove", function(event) {
        if (!mouseDown) return;
        
        var deltaX = event.clientX - lastMouseX;
        var deltaY = event.clientY - lastMouseY;
        
        cameraRotation.y += deltaX * 0.5;
        cameraRotation.x += deltaY * 0.5;
        
        // Clamp vertical rotation
        if (cameraRotation.x > 89) cameraRotation.x = 89;
        if (cameraRotation.x < -89) cameraRotation.x = -89;
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
    });
    
    canvas.addEventListener("wheel", function(event) {
        event.preventDefault();
        zoom += event.deltaY * 0.01;
        if (zoom < 3) zoom = 3;
        if (zoom > 15) zoom = 15;
        document.getElementById("zoomSlider").value = zoom;
        document.getElementById("zoom-value").textContent = zoom.toFixed(1);
    });
    
    canvas.addEventListener("contextmenu", function(event) {
        event.preventDefault();
    });
}

function setupControlListeners() {
    // Panel angle sliders
    var panel1Slider = document.getElementById("panel1Angle");
    var panel1Display = document.getElementById("panel1Angle-value");
    if (panel1Slider) {
        panel1Slider.addEventListener("input", function() {
            panel1Angle = parseFloat(this.value);
            panel1Display.textContent = panel1Angle.toFixed(0) + "°";
            updateBuffers();
        });
    }
    
    var panel2Slider = document.getElementById("panel2Angle");
    var panel2Display = document.getElementById("panel2Angle-value");
    if (panel2Slider) {
        panel2Slider.addEventListener("input", function() {
            panel2Angle = parseFloat(this.value);
            panel2Display.textContent = panel2Angle.toFixed(0) + "°";
            updateBuffers();
        });
    }
    
    var panel3Slider = document.getElementById("panel3Angle");
    var panel3Display = document.getElementById("panel3Angle-value");
    if (panel3Slider) {
        panel3Slider.addEventListener("input", function() {
            panel3Angle = parseFloat(this.value);
            panel3Display.textContent = panel3Angle.toFixed(0) + "°";
            updateBuffers();
        });
    }
    
    var panel4Slider = document.getElementById("panel4Angle");
    var panel4Display = document.getElementById("panel4Angle-value");
    if (panel4Slider) {
        panel4Slider.addEventListener("input", function() {
            panel4Angle = parseFloat(this.value);
            panel4Display.textContent = panel4Angle.toFixed(0) + "°";
            updateBuffers();
        });
    }
    
    // Zoom slider
    var zoomSlider = document.getElementById("zoomSlider");
    var zoomDisplay = document.getElementById("zoom-value");
    zoomSlider.addEventListener("input", function() {
        zoom = parseFloat(this.value);
        zoomDisplay.textContent = zoom.toFixed(1);
    });
    
    // Lighting controls
    document.getElementById("ambientColor").addEventListener("input", function() {
        ambientColor = hexToRgb(this.value);
    });
    
    document.getElementById("diffuseColor").addEventListener("input", function() {
        diffuseColor = hexToRgb(this.value);
    });
    
    document.getElementById("specularColor").addEventListener("input", function() {
        specularColor = hexToRgb(this.value);
    });
    
    var shininessSlider = document.getElementById("shininess");
    var shininessDisplay = document.getElementById("shininess-value");
    shininessSlider.addEventListener("input", function() {
        shininess = parseFloat(this.value);
        shininessDisplay.textContent = this.value;
    });
    
    ["lightX", "lightY", "lightZ"].forEach(function(id) {
        var slider = document.getElementById(id);
        var display = document.getElementById(id + "-value");
        slider.addEventListener("input", function() {
            var value = parseFloat(this.value);
            display.textContent = value.toFixed(1);
            var axis = id.charAt(id.length - 1).toLowerCase();
            if (axis === 'x') lightPosition[0] = value;
            else if (axis === 'y') lightPosition[1] = value;
            else if (axis === 'z') lightPosition[2] = value;
        });
    });
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? vec3(
        parseInt(result[1], 16) / 255.0,
        parseInt(result[2], 16) / 255.0,
        parseInt(result[3], 16) / 255.0
    ) : vec3(1.0, 1.0, 1.0);
}

// Animation control functions
function openDoors() {
    // Simulate folding door opening from center
    isOpening = true;
    isClosing = false;
    isFolding = false;
    var openBtn = document.getElementById("openBtn");
    var closeBtn = document.getElementById("closeBtn");
    var foldBtn = document.getElementById("foldBtn");
    if (openBtn) openBtn.classList.add("active");
    if (closeBtn) closeBtn.classList.remove("active");
    if (foldBtn) foldBtn.classList.remove("active");
}

function closeDoors() {
    // Close all hinges back to straight position
    isClosing = true;
    isOpening = false;
    isFolding = false;
    var openBtn = document.getElementById("openBtn");
    var closeBtn = document.getElementById("closeBtn");
    var foldBtn = document.getElementById("foldBtn");
    if (closeBtn) closeBtn.classList.add("active");
    if (openBtn) openBtn.classList.remove("active");
    if (foldBtn) foldBtn.classList.remove("active");
}

function foldDoors() {
    // Fold doors: panel 2 = 170°, panel 3 = -170°, panel 4 = 170°
    isFolding = true;
    isOpening = false;
    isClosing = false;
    var openBtn = document.getElementById("openBtn");
    var closeBtn = document.getElementById("closeBtn");
    var foldBtn = document.getElementById("foldBtn");
    if (foldBtn) foldBtn.classList.add("active");
    if (openBtn) openBtn.classList.remove("active");
    if (closeBtn) closeBtn.classList.remove("active");
}

function resetAnimation() {
    panel1Angle = 0;
    panel2Angle = 0;
    panel3Angle = 0;
    panel4Angle = 0;
    isOpening = false;
    isClosing = false;
    
    var panel1Slider = document.getElementById("panel1Angle");
    var panel2Slider = document.getElementById("panel2Angle");
    var panel3Slider = document.getElementById("panel3Angle");
    var panel4Slider = document.getElementById("panel4Angle");
    
    if (panel1Slider) {
        panel1Slider.value = "0";
        document.getElementById("panel1Angle-value").textContent = "0°";
    }
    if (panel2Slider) {
        panel2Slider.value = "0";
        document.getElementById("panel2Angle-value").textContent = "0°";
    }
    if (panel3Slider) {
        panel3Slider.value = "0";
        document.getElementById("panel3Angle-value").textContent = "0°";
    }
    if (panel4Slider) {
        panel4Slider.value = "0";
        document.getElementById("panel4Angle-value").textContent = "0°";
    }
    
    var openBtn = document.getElementById("openBtn");
    var closeBtn = document.getElementById("closeBtn");
    if (openBtn) openBtn.classList.remove("active");
    if (closeBtn) closeBtn.classList.remove("active");
    updateBuffers();
}

function stopAnimation() {
    isOpening = false;
    isClosing = false;
    var openBtn = document.getElementById("openBtn");
    var closeBtn = document.getElementById("closeBtn");
    if (openBtn) openBtn.classList.remove("active");
    if (closeBtn) closeBtn.classList.remove("active");
}

function toggleLighting() {
    lightingEnabled = !lightingEnabled;
    var btn = document.getElementById("toggleLighting");
    if (lightingEnabled) {
        btn.textContent = "Lighting: ON";
        btn.classList.add("active");
    } else {
        btn.textContent = "Lighting: OFF";
        btn.classList.remove("active");
    }
}

function resetLighting() {
    ambientColor = vec3(0.2, 0.2, 0.2);
    diffuseColor = vec3(1.0, 1.0, 1.0);
    specularColor = vec3(1.0, 1.0, 1.0);
    lightPosition = vec3(3.0, 5.0, 3.0);
    shininess = 50.0;
    
    document.getElementById("ambientColor").value = "#333333";
    document.getElementById("diffuseColor").value = "#ffffff";
    document.getElementById("specularColor").value = "#ffffff";
    document.getElementById("lightX").value = "3";
    document.getElementById("lightY").value = "5";
    document.getElementById("lightZ").value = "3";
    document.getElementById("shininess").value = "50";
    
    document.getElementById("lightX-value").textContent = "3.0";
    document.getElementById("lightY-value").textContent = "5.0";
    document.getElementById("lightZ-value").textContent = "3.0";
    document.getElementById("shininess-value").textContent = "50";
}

function toggleTexture() {
    useTexture = !useTexture;
    var btn = document.getElementById("toggleTextureBtn");
    if (useTexture) {
        btn.textContent = "Texture: ON";
        btn.classList.add("active");
    } else {
        btn.textContent = "Texture: OFF";
        btn.classList.remove("active");
    }
}

function toggleWireframe() {
    wireframe = !wireframe;
    var btn = document.getElementById("wireframeBtn");
    if (wireframe) {
        btn.textContent = "Wireframe: ON";
    } else {
        btn.textContent = "Wireframe: OFF";
    }
}

function resetView() {
    cameraRotation = { x: 20, y: 45 };
    zoom = 8;
    document.getElementById("zoomSlider").value = "8";
    document.getElementById("zoom-value").textContent = "8.0";
}

function updateAnimation() {
    var needsUpdate = false;
    
    if (isOpening) {
        // Open all panels to 90 degrees (from any angle)
        if (panel1Angle < 90) {
            panel1Angle += animationSpeed;
            if (panel1Angle > 90) panel1Angle = 90;
            needsUpdate = true;
        } else if (panel1Angle > 90) {
            panel1Angle -= animationSpeed;
            if (panel1Angle < 90) panel1Angle = 90;
            needsUpdate = true;
        }
        
        if (panel2Angle < 90) {
            panel2Angle += animationSpeed;
            if (panel2Angle > 90) panel2Angle = 90;
            needsUpdate = true;
        } else if (panel2Angle > 90) {
            panel2Angle -= animationSpeed;
            if (panel2Angle < 90) panel2Angle = 90;
            needsUpdate = true;
        }
        
        if (panel3Angle < 90) {
            panel3Angle += animationSpeed;
            if (panel3Angle > 90) panel3Angle = 90;
            needsUpdate = true;
        } else if (panel3Angle > 90) {
            panel3Angle -= animationSpeed;
            if (panel3Angle < 90) panel3Angle = 90;
            needsUpdate = true;
        }
        
        if (panel4Angle < 90) {
            panel4Angle += animationSpeed;
            if (panel4Angle > 90) panel4Angle = 90;
            needsUpdate = true;
        } else if (panel4Angle > 90) {
            panel4Angle -= animationSpeed;
            if (panel4Angle < 90) panel4Angle = 90;
            needsUpdate = true;
        }
        
        if (Math.abs(panel1Angle - 90) < 0.5 && 
            Math.abs(panel2Angle - 90) < 0.5 && 
            Math.abs(panel3Angle - 90) < 0.5 && 
            Math.abs(panel4Angle - 90) < 0.5) {
            panel1Angle = 90;
            panel2Angle = 90;
            panel3Angle = 90;
            panel4Angle = 90;
            isOpening = false;
        }
    }
    
    if (isClosing) {
        // Close all panels to 0 (from any angle)
        if (panel1Angle > 0) {
            panel1Angle -= animationSpeed;
            if (panel1Angle < 0) panel1Angle = 0;
            needsUpdate = true;
        } else if (panel1Angle < 0) {
            panel1Angle += animationSpeed;
            if (panel1Angle > 0) panel1Angle = 0;
            needsUpdate = true;
        }
        
        if (panel2Angle > 0) {
            panel2Angle -= animationSpeed;
            if (panel2Angle < 0) panel2Angle = 0;
            needsUpdate = true;
        } else if (panel2Angle < 0) {
            panel2Angle += animationSpeed;
            if (panel2Angle > 0) panel2Angle = 0;
            needsUpdate = true;
        }
        
        if (panel3Angle > 0) {
            panel3Angle -= animationSpeed;
            if (panel3Angle < 0) panel3Angle = 0;
            needsUpdate = true;
        } else if (panel3Angle < 0) {
            panel3Angle += animationSpeed;
            if (panel3Angle > 0) panel3Angle = 0;
            needsUpdate = true;
        }
        
        if (panel4Angle > 0) {
            panel4Angle -= animationSpeed;
            if (panel4Angle < 0) panel4Angle = 0;
            needsUpdate = true;
        } else if (panel4Angle < 0) {
            panel4Angle += animationSpeed;
            if (panel4Angle > 0) panel4Angle = 0;
            needsUpdate = true;
        }
        
        if (Math.abs(panel1Angle) < 0.5 && 
            Math.abs(panel2Angle) < 0.5 && 
            Math.abs(panel3Angle) < 0.5 && 
            Math.abs(panel4Angle) < 0.5) {
            panel1Angle = 0;
            panel2Angle = 0;
            panel3Angle = 0;
            panel4Angle = 0;
            isClosing = false;
        }
    }
    
    if (isFolding) {
        // Fold animation: panel1 stays 0, panel2 -> 170, panel3 -> -170, panel4 -> 170
        if (panel1Angle > 0) {
            panel1Angle -= animationSpeed;
            if (panel1Angle < 0) panel1Angle = 0;
            needsUpdate = true;
        } else if (panel1Angle < 0) {
            panel1Angle += animationSpeed;
            if (panel1Angle > 0) panel1Angle = 0;
            needsUpdate = true;
        }
        
        if (panel2Angle < 170) {
            panel2Angle += animationSpeed;
            if (panel2Angle > 170) panel2Angle = 170;
            needsUpdate = true;
        } else if (panel2Angle > 170) {
            panel2Angle -= animationSpeed;
            if (panel2Angle < 170) panel2Angle = 170;
            needsUpdate = true;
        }
        
        if (panel3Angle > -170) {
            panel3Angle -= animationSpeed;
            if (panel3Angle < -170) panel3Angle = -170;
            needsUpdate = true;
        } else if (panel3Angle < -170) {
            panel3Angle += animationSpeed;
            if (panel3Angle > -170) panel3Angle = -170;
            needsUpdate = true;
        }
        
        if (panel4Angle < 170) {
            panel4Angle += animationSpeed;
            if (panel4Angle > 170) panel4Angle = 170;
            needsUpdate = true;
        } else if (panel4Angle > 170) {
            panel4Angle -= animationSpeed;
            if (panel4Angle < 170) panel4Angle = 170;
            needsUpdate = true;
        }
        
        // Check if all panels reached their target
        if (Math.abs(panel1Angle - 0) < 0.5 && 
            Math.abs(panel2Angle - 170) < 0.5 && 
            Math.abs(panel3Angle - (-170)) < 0.5 && 
            Math.abs(panel4Angle - 170) < 0.5) {
            panel1Angle = 0;
            panel2Angle = 170;
            panel3Angle = -170;
            panel4Angle = 170;
            isFolding = false;
            needsUpdate = true;
        }
    }
    
    if (needsUpdate) {
        var panel1Slider = document.getElementById("panel1Angle");
        var panel2Slider = document.getElementById("panel2Angle");
        var panel3Slider = document.getElementById("panel3Angle");
        var panel4Slider = document.getElementById("panel4Angle");
        
        if (panel1Slider) {
            panel1Slider.value = panel1Angle.toFixed(0);
            document.getElementById("panel1Angle-value").textContent = panel1Angle.toFixed(0) + "°";
        }
        if (panel2Slider) {
            panel2Slider.value = panel2Angle.toFixed(0);
            document.getElementById("panel2Angle-value").textContent = panel2Angle.toFixed(0) + "°";
        }
        if (panel3Slider) {
            panel3Slider.value = panel3Angle.toFixed(0);
            document.getElementById("panel3Angle-value").textContent = panel3Angle.toFixed(0) + "°";
        }
        if (panel4Slider) {
            panel4Slider.value = panel4Angle.toFixed(0);
            document.getElementById("panel4Angle-value").textContent = panel4Angle.toFixed(0) + "°";
        }
        
        updateBuffers();
    }
}

function normalMatrixFromMat4(m) {
    var upper = mat3();
    for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
            upper[i][j] = m[i][j];
        }
    }
    return inverse(transpose(upper));
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Update animation
    updateAnimation();
    
    // Calculate camera position
    var camX = zoom * Math.cos(radians(cameraRotation.x)) * Math.sin(radians(cameraRotation.y));
    var camY = zoom * Math.sin(radians(cameraRotation.x));
    var camZ = zoom * Math.cos(radians(cameraRotation.x)) * Math.cos(radians(cameraRotation.y));
    
    eye = vec3(camX, camY + 2, camZ);
    at = vec3(0, 2, 0);
    
    var viewMatrix = lookAt(eye, at, up);
    modelViewMatrix = viewMatrix;
    
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    
    var normalMatrix = normalMatrixFromMat4(modelViewMatrix);
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix));
    
    // Transform light position to eye space
    var lightPosVec4 = vec4(lightPosition[0], lightPosition[1], lightPosition[2], 1.0);
    var lightPosEyeSpace = mult(viewMatrix, lightPosVec4);
    var lightPosEye = vec3(lightPosEyeSpace[0], lightPosEyeSpace[1], lightPosEyeSpace[2]);
    
    // Set lighting uniforms
    gl.uniform3fv(ambientLightLoc, flatten(ambientColor));
    gl.uniform3fv(diffuseLightLoc, flatten(diffuseColor));
    gl.uniform3fv(specularLightLoc, flatten(specularColor));
    gl.uniform3fv(lightPositionLoc, flatten(lightPosEye));
    gl.uniform1f(shininessLoc, shininess);
    gl.uniform1i(enableLightingLoc, lightingEnabled ? 1 : 0);
    
    // Set texture uniforms
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, doorTexture);
    gl.uniform1i(textureLoc, 0);
    gl.uniform1i(useTextureLoc, useTexture ? 1 : 0);
    
    // Draw
    if (wireframe) {
        for (var i = 0; i < indices.length; i += 3) {
            gl.drawElements(gl.LINE_LOOP, 3, gl.UNSIGNED_SHORT, i * 2);
        }
    } else {
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    }
    
    requestAnimationFrame(render);
}
