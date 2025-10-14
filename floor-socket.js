var canvas;
var gl;
var program;

var vBuffer, cBuffer, nBuffer, iBuffer, tBuffer;
var modelViewMatrixLoc, projectionMatrixLoc, normalMatrixLoc;
var modelViewMatrix = mat4();
var projectionMatrix;

var eye = vec3(3, 3, 3);
var at = vec3(0, 0, 0);
var up = vec3(0, 1, 0);

var mouseDown = false;
var mouseButton = 0;
var lastMouseX = 0;
var lastMouseY = 0;

var cameraRotation = { x: 30, y: -45 };
var objectRotation = { x: 0, y: 0, z: 0 };
var translation = { x: 0, y: 0, z: 0 };
var scaling = { x: 1, y: 1, z: 1 };
var zoom = 5;

var coverAngle = 0;
var isOpening = false;
var isClosing = false;
var openSpeed = 2.5;

var showGrid = true;
var wireframe = false;

var animationActive = false;
var animationAxis = null;
var animationSpeed = 2;

var vertices = [];
var colors = [];
var normals = [];
var indices = [];
var texCoords = [];

var COVER_MAX_ANGLE = 85;

var orthographic = false;

// Texture variables
var checkerboardTexture;
var imageTexture;
var currentTexture;
var textureMode = 1; // 0 = none, 1 = checkerboard, 2 = image
var useTexture = true;
var textureLoc, textureModeLoc, useTextureLoc;

// Lighting variables
var lightingEnabled = true;
var ambientColor = vec3(0.2, 0.2, 0.2);
var diffuseColor = vec3(1.0, 1.0, 1.0);
var specularColor = vec3(1.0, 1.0, 1.0);
var lightPosition = vec3(2.0, 3.0, 2.0);
var shininess = 50.0;

var ambientLightLoc, diffuseLightLoc, specularLightLoc;
var lightPositionLoc, shininessLoc, enableLightingLoc;

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");
    
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.7, 0.7, 0.7, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    createFloorSocket();
    createGrid();

    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    setupBuffers();

    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");
    normalMatrixLoc = gl.getUniformLocation(program, "normalMatrix");
    
    // Get lighting uniform locations
    ambientLightLoc = gl.getUniformLocation(program, "ambientLight");
    diffuseLightLoc = gl.getUniformLocation(program, "diffuseLight");
    specularLightLoc = gl.getUniformLocation(program, "specularLight");
    lightPositionLoc = gl.getUniformLocation(program, "lightPosition");
    shininessLoc = gl.getUniformLocation(program, "shininess");
    enableLightingLoc = gl.getUniformLocation(program, "enableLighting");
    
    // Get texture uniform locations
    textureLoc = gl.getUniformLocation(program, "uTexture");
    textureModeLoc = gl.getUniformLocation(program, "textureMode");
    useTextureLoc = gl.getUniformLocation(program, "useTexture");

    updateProjectionMatrix();
    
    // Initialize textures
    initTextures();

    setupEventListeners();
    setupControlListeners();
    setupLightingListeners();

    render();
};

function initTextures() {
    // Create checkerboard texture
    checkerboardTexture = createCheckerboardTexture();
    
    // Create default image texture (simple gradient)
    imageTexture = createDefaultImageTexture();
    
    // Set current texture to checkerboard
    currentTexture = checkerboardTexture;
}

function createCheckerboardTexture() {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    var size = 64;
    var checkSize = 8;
    var data = new Uint8Array(size * size * 4);
    
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            var isWhite = ((Math.floor(i / checkSize) + Math.floor(j / checkSize)) % 2) === 0;
            var idx = (i * size + j) * 4;
            
            if (isWhite) {
                data[idx] = 255;     // R - Pure white
                data[idx + 1] = 255; // G
                data[idx + 2] = 255; // B
            } else {
                data[idx] = 20;      // R - Much darker black
                data[idx + 1] = 20;  // G
                data[idx + 2] = 20;  // B
            }
            data[idx + 3] = 255;     // A
        }
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    return texture;
}

function createDefaultImageTexture() {
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    
    var size = 64;
    var data = new Uint8Array(size * size * 4);
    
    for (var i = 0; i < size; i++) {
        for (var j = 0; j < size; j++) {
            var idx = (i * size + j) * 4;
            
            // Create a gradient pattern
            var r = Math.floor(255 * (i / size));
            var g = Math.floor(255 * (j / size));
            var b = 150;
            
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
        }
    }
    
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    
    return texture;
}

function loadCustomTexture(event) {
    var file = event.target.files[0];
    if (!file) return;
    
    var reader = new FileReader();
    reader.onload = function(e) {
        var img = new Image();
        img.onload = function() {
            imageTexture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, imageTexture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
            
            // Check if image is power of 2
            if (isPowerOf2(img.width) && isPowerOf2(img.height)) {
                gl.generateMipmap(gl.TEXTURE_2D);
            } else {
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            }
            
            // Switch to image texture mode
            textureMode = 2;
            document.getElementById("textureMode").value = "2";
            currentTexture = imageTexture;
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function isPowerOf2(value) {
    return (value & (value - 1)) === 0;
}

function changeTextureMode() {
    textureMode = parseInt(document.getElementById("textureMode").value);
    
    if (textureMode === 1) {
        currentTexture = checkerboardTexture;
    } else if (textureMode === 2) {
        currentTexture = imageTexture;
    }
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

function setupLightingListeners() {
    // Ambient color
    document.getElementById("ambientColor").addEventListener("input", function() {
        ambientColor = hexToRgb(this.value);
        document.getElementById("ambientPreview").style.backgroundColor = this.value;
    });
    
    // Diffuse color
    document.getElementById("diffuseColor").addEventListener("input", function() {
        diffuseColor = hexToRgb(this.value);
        document.getElementById("diffusePreview").style.backgroundColor = this.value;
    });
    
    // Specular color
    document.getElementById("specularColor").addEventListener("input", function() {
        specularColor = hexToRgb(this.value);
        document.getElementById("specularPreview").style.backgroundColor = this.value;
    });
    
    // Shininess
    var shininessSlider = document.getElementById("shininess");
    var shininessDisplay = document.getElementById("shininess-value");
    shininessSlider.addEventListener("input", function() {
        shininess = parseFloat(this.value);
        shininessDisplay.textContent = this.value;
    });
    
    // Light position
    ["lightX", "lightY", "lightZ"].forEach(function(id) {
        var slider = document.getElementById(id);
        var display = document.getElementById(id + "-value");
        slider.addEventListener("input", function() {
            var axis = id.substr(5).toLowerCase();
            if (axis === 'x') lightPosition[0] = parseFloat(this.value);
            else if (axis === 'y') lightPosition[1] = parseFloat(this.value);
            else if (axis === 'z') lightPosition[2] = parseFloat(this.value);
            display.textContent = parseFloat(this.value).toFixed(1);
        });
    });
    
    // Initialize color previews
    document.getElementById("ambientPreview").style.backgroundColor = "#333333";
    document.getElementById("diffusePreview").style.backgroundColor = "#ffffff";
    document.getElementById("specularPreview").style.backgroundColor = "#ffffff";
}

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? vec3(
        parseInt(result[1], 16) / 255.0,
        parseInt(result[2], 16) / 255.0,
        parseInt(result[3], 16) / 255.0
    ) : vec3(1.0, 1.0, 1.0);
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
    lightPosition = vec3(2.0, 3.0, 2.0);
    shininess = 50.0;
    
    document.getElementById("ambientColor").value = "#333333";
    document.getElementById("diffuseColor").value = "#ffffff";
    document.getElementById("specularColor").value = "#ffffff";
    document.getElementById("lightX").value = "2";
    document.getElementById("lightY").value = "3";
    document.getElementById("lightZ").value = "2";
    document.getElementById("shininess").value = "50";
    
    document.getElementById("lightX-value").textContent = "2.0";
    document.getElementById("lightY-value").textContent = "3.0";
    document.getElementById("lightZ-value").textContent = "2.0";
    document.getElementById("shininess-value").textContent = "50";
    
    document.getElementById("ambientPreview").style.backgroundColor = "#333333";
    document.getElementById("diffusePreview").style.backgroundColor = "#ffffff";
    document.getElementById("specularPreview").style.backgroundColor = "#ffffff";
}

function updateProjectionMatrix() {
    if (orthographic) {
        var size = zoom;
        projectionMatrix = ortho(-size, size, -size, size, 0.1, 100);
    } else {
        projectionMatrix = perspective(45, canvas.width/canvas.height, 0.1, 100);
    }
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));
}

function computeNormal(p1, p2, p3) {
    var v1 = subtract(p2, p1);
    var v2 = subtract(p3, p1);
    var normal = cross(vec3(v1[0], v1[1], v1[2]), vec3(v2[0], v2[1], v2[2]));
    return normalize(normal);
}

function createFloorSocket() {
    vertices = [];
    colors = [];
    normals = [];
    indices = [];
    texCoords = [];
    
    const baseColor = [0.75, 0.75, 0.78, 1.0];
    const recessColor = [0.4, 0.4, 0.4, 1.0];
    const popUpBodyColor = [0.5, 0.5, 0.5, 1.0];
    const socketPanelColor = [1.0, 1.0, 1.0, 1.0];
    const socketHoleColor = [0.1, 0.1, 0.1, 1.0];
    const buttonColor = [0.6, 0.6, 0.6, 1.0];

    const baseWidth = 2.0;
    const baseDepth = 1.6;
    const baseHeight = 0.2;
    const bevelSize = 0.1;

    const popUpWidth = baseWidth - 0.6;
    const popUpDepth = baseDepth - 0.4;
    const popUpHeight = popUpDepth * 0.9;

    addBaseFrame(0, 0, 0, baseWidth, baseDepth, baseHeight, bevelSize, baseColor);
    addBox(0, baseHeight/2 - 0.01, 0, baseWidth - bevelSize*2, 0.02, baseDepth - bevelSize*2, recessColor);

    const buttonZPos = -(baseDepth / 2) + 0.2;
    addBox(0, baseHeight / 2, buttonZPos, 0.5, 0.02, 0.15, buttonColor);
    addTriangle(0, baseHeight / 2 + 0.011, buttonZPos, 0.1, 0.07, [0.3, 0.3, 0.3, 1.0]);

    const hingeZPosition = (popUpDepth / 2);
    
    if (coverAngle === 0) {
        addBox(0, baseHeight / 2 - 0.1, 0, popUpWidth, 0.02, popUpDepth, baseColor);
    } else {
        addPopUpMechanism(0, baseHeight/2, 0, popUpWidth, popUpDepth, popUpHeight, 
                         90 - coverAngle, hingeZPosition, popUpBodyColor, socketPanelColor, socketHoleColor);
    }
}

function addBaseFrame(x, y, z, width, depth, height, bevel, color) {
    const startIndex = vertices.length;
    let currentIdx = 0;

    const w2 = width / 2;
    const d2 = depth / 2;
    const h2 = height / 2;
    const bw = w2 - bevel;
    const bd = d2 - bevel;

    // Define corner vertices
    const v_bfl = vec4(x - w2, y - h2, z + d2, 1.0);  // bottom-front-left
    const v_bfr = vec4(x + w2, y - h2, z + d2, 1.0);  // bottom-front-right
    const v_bbr = vec4(x + w2, y - h2, z - d2, 1.0);  // bottom-back-right
    const v_bbl = vec4(x - w2, y - h2, z - d2, 1.0);  // bottom-back-left
    
    const v_tfl = vec4(x - bw, y + h2, z + bd, 1.0);  // top-front-left
    const v_tfr = vec4(x + bw, y + h2, z + bd, 1.0);  // top-front-right
    const v_tbr = vec4(x + bw, y + h2, z - bd, 1.0);  // top-back-right
    const v_tbl = vec4(x - bw, y + h2, z - bd, 1.0);  // top-back-left

    const backColor = [0.6, 0.6, 0.65, 1.0];
    
    // TOP FACE (inner rectangle)
    vertices.push(v_tfl, v_tfr, v_tbr, v_tbl);
    for(let i=0; i<4; i++) {
        colors.push(color);
        normals.push(vec3(0, 1, 0));
    }
    texCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    indices.push(startIndex + 0, startIndex + 1, startIndex + 2);
    indices.push(startIndex + 0, startIndex + 2, startIndex + 3);
    currentIdx += 4;
    
    // FRONT BEVEL (trapezoid)
    vertices.push(v_bfl, v_bfr, v_tfr, v_tfl);
    for(let i=0; i<4; i++) {
        colors.push(color);
        let norm = computeNormal(v_bfl, v_bfr, v_tfr);
        normals.push(norm);
    }
    texCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 1, startIndex + currentIdx + 2);
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 2, startIndex + currentIdx + 3);
    currentIdx += 4;
    
    // RIGHT BEVEL (trapezoid)
    vertices.push(v_bfr, v_bbr, v_tbr, v_tfr);
    for(let i=0; i<4; i++) {
        colors.push(color);
        let norm = computeNormal(v_bfr, v_bbr, v_tbr);
        normals.push(norm);
    }
    texCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 1, startIndex + currentIdx + 2);
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 2, startIndex + currentIdx + 3);
    currentIdx += 4;
    
    // BACK BEVEL (trapezoid)
    vertices.push(v_bbr, v_bbl, v_tbl, v_tbr);
    for(let i=0; i<4; i++) {
        colors.push(backColor);
        let norm = computeNormal(v_bbr, v_bbl, v_tbl);
        normals.push(norm);
    }
    texCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 1, startIndex + currentIdx + 2);
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 2, startIndex + currentIdx + 3);
    currentIdx += 4;
    
    // LEFT BEVEL (trapezoid)
    vertices.push(v_bbl, v_bfl, v_tfl, v_tbl);
    for(let i=0; i<4; i++) {
        colors.push(color);
        let norm = computeNormal(v_bbl, v_bfl, v_tfl);
        normals.push(norm);
    }
    texCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 1, startIndex + currentIdx + 2);
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 2, startIndex + currentIdx + 3);
    currentIdx += 4;
    
    // BOTTOM FACE
    vertices.push(v_bbl, v_bbr, v_bfr, v_bfl);
    for(let i=0; i<4; i++) {
        colors.push(color);
        normals.push(vec3(0, -1, 0));
    }
    texCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 1, startIndex + currentIdx + 2);
    indices.push(startIndex + currentIdx + 0, startIndex + currentIdx + 2, startIndex + currentIdx + 3);
}

function addPopUpMechanism(x, y, z, width, depth, height, angle, hingeZ, bodyColor, panelColor, holeColor) {
    const startIndex = vertices.length;
    let currentVertex = 0;

    const localVertices = [];
    const localColors = [];
    const localNormals = [];
    const localIndices = [];

    const w2 = width / 2;
    const d2 = depth / 2;

    const localTexCoords = [];
    
    // Define base vertices positions
    const v_bbl = vec4(-w2, 0, -d2, 1.0);      // bottom-back-left
    const v_bbr = vec4( w2, 0, -d2, 1.0);      // bottom-back-right
    const v_bfr = vec4( w2, 0,  d2, 1.0);      // bottom-front-right
    const v_bfl = vec4(-w2, 0,  d2, 1.0);      // bottom-front-left
    const v_tfl = vec4(-w2, height, d2, 1.0);  // top-front-left
    const v_tfr = vec4( w2, height, d2, 1.0);  // top-front-right
    
    // BOTTOM FACE (lantai bagian bawah) - 4 vertices
    localVertices.push(v_bbl, v_bbr, v_bfr, v_bfl);
    for(let i=0; i<4; i++) {
        localColors.push(bodyColor);
        localNormals.push(vec3(0, -1, 0));
    }
    localTexCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    localIndices.push(0, 1, 2,  0, 2, 3);
    currentVertex += 4;
    
    // FRONT SLANTED FACE (miring depan) - 4 vertices  
    localVertices.push(v_bfl, v_bfr, v_tfr, v_tfl);
    for(let i=0; i<4; i++) {
        localColors.push(bodyColor);
        // Calculate proper normal for slanted face
        let norm = computeNormal(v_bfl, v_bfr, v_tfr);
        localNormals.push(norm);
    }
    localTexCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    localIndices.push(4, 5, 6,  4, 6, 7);
    currentVertex += 4;
    
    // LEFT FACE (sisi kiri - segitiga) - 3 vertices
    localVertices.push(v_bbl, v_bfl, v_tfl);
    for(let i=0; i<3; i++) {
        localColors.push(bodyColor);
        localNormals.push(vec3(-1, 0, 0));
    }
    localTexCoords.push(vec2(0, 0), vec2(1, 0), vec2(0.5, 1));
    localIndices.push(8, 9, 10);
    currentVertex += 3;
    
    // RIGHT FACE (sisi kanan - segitiga) - 3 vertices
    localVertices.push(v_bbr, v_tfr, v_bfr);
    for(let i=0; i<3; i++) {
        localColors.push(bodyColor);
        localNormals.push(vec3(1, 0, 0));
    }
    localTexCoords.push(vec2(0, 0), vec2(0.5, 1), vec2(1, 0));
    localIndices.push(11, 12, 13);
    currentVertex += 3;
    
    // BACK FACE (belakang - segitiga kecil) - 4 vertices (trapezoid)
    localVertices.push(v_bbl, v_bbr, v_tfr, v_tfl);
    for(let i=0; i<4; i++) {
        localColors.push(bodyColor);
        localNormals.push(vec3(0, 0, -1));
    }
    localTexCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    localIndices.push(14, 15, 16,  14, 16, 17);
    currentVertex += 4;

    const backPanelColor = [
        Math.min(1.0, bodyColor[0] + 0.3), 
        Math.min(1.0, bodyColor[1] + 0.3), 
        Math.min(1.0, bodyColor[2] + 0.3), 
        1.0
    ];
    
    const panelWidth = width * 1.2;
    const panelHeight = height * 1.05;
    const panelW2 = panelWidth / 2;
    
    const backZOffset = d2 + 0.0001;
    const panelThickness = 0.05;
    
    // Back panel - front face (facing forward)
    localVertices.push(
        vec4(-panelW2, 0, backZOffset, 1.0),                    // 0: bottom-left
        vec4( panelW2, 0, backZOffset, 1.0),                    // 1: bottom-right
        vec4( panelW2, panelHeight, backZOffset, 1.0),          // 2: top-right
        vec4(-panelW2, panelHeight, backZOffset, 1.0)           // 3: top-left
    );
    
    for(let i = 0; i < 4; i++) {
        localColors.push(backPanelColor);
        localNormals.push(vec3(0, 0, 1));  // Front face normal
    }
    
    // Texture coords for front face
    localTexCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    
    // Back panel - back face (facing backward)
    localVertices.push(
        vec4(-panelW2, 0, backZOffset + panelThickness, 1.0),           // 4: bottom-left
        vec4( panelW2, 0, backZOffset + panelThickness, 1.0),           // 5: bottom-right
        vec4( panelW2, panelHeight, backZOffset + panelThickness, 1.0), // 6: top-right
        vec4(-panelW2, panelHeight, backZOffset + panelThickness, 1.0)  // 7: top-left
    );
    
    for(let i = 0; i < 4; i++) {
        localColors.push(backPanelColor);
        localNormals.push(vec3(0, 0, -1));  // Back face normal
    }
    
    // Texture coords for back face
    localTexCoords.push(vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1));
    
    const backStart = currentVertex;
    localIndices.push(
        backStart, backStart + 1, backStart + 2,
        backStart, backStart + 2, backStart + 3,
        backStart + 4, backStart + 7, backStart + 6,
        backStart + 4, backStart + 6, backStart + 5,
        backStart, backStart + 4, backStart + 5,
        backStart, backStart + 5, backStart + 1,
        backStart + 2, backStart + 6, backStart + 7,
        backStart + 2, backStart + 7, backStart + 3,
        backStart + 3, backStart + 7, backStart + 4,
        backStart + 3, backStart + 4, backStart,
        backStart + 1, backStart + 5, backStart + 6,
        backStart + 1, backStart + 6, backStart + 2
    );
    
    currentVertex += 8;

    const panelOffset = -0.01;
    
    const p_bl = mix(localVertices[0], localVertices[4], 0.15);
    const p_br = mix(localVertices[1], localVertices[5], 0.15);
    const p_tr = mix(localVertices[1], localVertices[5], 0.85);
    const p_tl = mix(localVertices[0], localVertices[4], 0.85);
    
    let normal = cross(subtract(p_br, p_bl), subtract(p_tl, p_bl));
    normal = normalize(normal);
    const offsetVec = scale(panelOffset, vec4(normal[0], normal[1], normal[2], 0));

    // Socket panel (white panel with holes)
    localVertices.push(
        add(p_bl, offsetVec), add(p_tl, offsetVec),
        add(p_tr, offsetVec), add(p_br, offsetVec)
    );
    
    for(let i=0; i<4; i++) {
        localColors.push(panelColor);
        localNormals.push(normal);
    }
    
    // Texture coordinates for socket panel - proper UV mapping
    localTexCoords.push(vec2(0, 0), vec2(0, 1), vec2(1, 1), vec2(1, 0));
    
    localIndices.push(
        currentVertex, currentVertex + 1, currentVertex + 2,
        currentVertex, currentVertex + 2, currentVertex + 3
    );
    currentVertex += 4;
    
    const holeVisibleOffset = -0.05; 
    const socketHoleOffsetVec = scale(panelOffset + holeVisibleOffset, vec4(normal[0], normal[1], normal[2], 0));
    
    const holeRadius = 0.04;
    const holeSegments = 15;

    const leftSocketCenterX = 0.7;
    const socketCenterPoint = add(
        mix(
            mix(p_bl, p_br, leftSocketCenterX), 
            mix(p_tl, p_tr, leftSocketCenterX), 
            0.5
        ), 
        socketHoleOffsetVec
    );

    const panelRightVec = normalize(subtract(p_br, p_bl));
    const panelUpVec = normalize(subtract(p_tl, p_bl));
    
    const holeSeparation = 0.1;

    const leftHoleCenter = subtract(socketCenterPoint, scale(holeSeparation, panelRightVec));
    const rightHoleCenter = add(socketCenterPoint, scale(holeSeparation, panelRightVec));

    const createCircle = (center) => {
        const centerIndex = currentVertex;
        
        localVertices.push(center);
        localColors.push(holeColor);
        localNormals.push(normal);
        localTexCoords.push(vec2(0.5, 0.5));
        currentVertex++;
        
        for (let i = 0; i <= holeSegments; i++) {
            const angle = (i / holeSegments) * 2 * Math.PI;
            const x_comp = scale(holeRadius * Math.cos(angle), panelRightVec);
            const y_comp = scale(holeRadius * Math.sin(angle), panelUpVec);
            localVertices.push(add(add(center, x_comp), y_comp));
            localColors.push(holeColor);
            localNormals.push(normal);
            localTexCoords.push(vec2(0.5 + 0.5 * Math.cos(angle), 0.5 + 0.5 * Math.sin(angle)));
        }
        
        for (let i = 0; i < holeSegments; i++) {
            localIndices.push(centerIndex, currentVertex + i, currentVertex + i + 1);
        }
        currentVertex += (holeSegments + 1);
    };

    createCircle(leftHoleCenter);
    createCircle(rightHoleCenter);

    const rotMatrix = rotateX(-angle);
    
    for (let i = 0; i < localVertices.length; i++) {
        let v = vec4(localVertices[i]);
        let n = vec3(localNormals[i]);
        
        v[2] -= hingeZ;
        v = mult(rotMatrix, v);
        v[2] += hingeZ;
        
        v[0] += x; 
        v[1] += y; 
        v[2] += z;
        
        let n4 = vec4(n[0], n[1], n[2], 0);
        n4 = mult(rotMatrix, n4);
        n = vec3(n4[0], n4[1], n4[2]);
        
        vertices.push(v);
        colors.push(localColors[i]);
        normals.push(n);
        texCoords.push(localTexCoords[i]);
    }
    
    for(let i=0; i<localIndices.length; i++) {
        indices.push(startIndex + localIndices[i]);
    }
}

function addTriangle(x, y, z, width, height, color) {
    const startIndex = vertices.length;
    const w2 = width / 2;
    
    vertices.push(vec4(x, y, z - height/2, 1.0));
    vertices.push(vec4(x + w2, y, z + height/2, 1.0));
    vertices.push(vec4(x - w2, y, z + height/2, 1.0));
    
    for(var i=0; i<3; i++) {
        colors.push(color);
        normals.push(vec3(0, 1, 0));
    }
    
    texCoords.push(vec2(0.5, 0.0));
    texCoords.push(vec2(1.0, 1.0));
    texCoords.push(vec2(0.0, 1.0));
    
    indices.push(startIndex, startIndex+1, startIndex+2);
}

function createGrid() {
    var gridSize = 10;
    var gridStep = 0.5;
    var gridColor = [0.3, 0.3, 0.3, 1.0];

    var gridVertices = [];
    var gridColors = [];
    var gridNormals = [];
    
    var gridTexCoords = [];
    
    for (var i = -gridSize; i <= gridSize; i++) {
        var z_pos = i * gridStep;
        gridVertices.push(vec4(-gridSize * gridStep, 0, z_pos, 1.0));
        gridVertices.push(vec4(gridSize * gridStep, 0, z_pos, 1.0));
        gridColors.push(gridColor);
        gridColors.push(gridColor);
        gridNormals.push(vec3(0, 1, 0));
        gridNormals.push(vec3(0, 1, 0));
        gridTexCoords.push(vec2(0, 0));
        gridTexCoords.push(vec2(1, 0));
    }
    
    for (var i = -gridSize; i <= gridSize; i++) {
        var x_pos = i * gridStep;
        gridVertices.push(vec4(x_pos, 0, -gridSize * gridStep, 1.0));
        gridVertices.push(vec4(x_pos, 0, gridSize * gridStep, 1.0));
        gridColors.push(gridColor);
        gridColors.push(gridColor);
        gridNormals.push(vec3(0, 1, 0));
        gridNormals.push(vec3(0, 1, 0));
        gridTexCoords.push(vec2(0, 0));
        gridTexCoords.push(vec2(0, 1));
    }

    vertices.push(...gridVertices);
    colors.push(...gridColors);
    normals.push(...gridNormals);
    texCoords.push(...gridTexCoords);
}

function addBox(x, y, z, width, height, depth, color) {
    const startIndex = vertices.length;
    
    const w2 = width / 2;
    const h2 = height / 2;
    const d2 = depth / 2;
    
    const boxVertices = [
        vec4(x - w2, y - h2, z + d2, 1.0), vec4(x + w2, y - h2, z + d2, 1.0),
        vec4(x + w2, y + h2, z + d2, 1.0), vec4(x - w2, y + h2, z + d2, 1.0),
        vec4(x - w2, y - h2, z - d2, 1.0), vec4(x + w2, y - h2, z - d2, 1.0),
        vec4(x + w2, y + h2, z - d2, 1.0), vec4(x - w2, y + h2, z - d2, 1.0)
    ];
    
    const boxNormals = [
        vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1), vec3(0, 0, 1),
        vec3(0, 0, -1), vec3(0, 0, -1), vec3(0, 0, -1), vec3(0, 0, -1)
    ];
    
    const boxTexCoords = [
        vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1),
        vec2(0, 0), vec2(1, 0), vec2(1, 1), vec2(0, 1)
    ];
    
    for (var i = 0; i < boxVertices.length; i++) {
        vertices.push(boxVertices[i]);
        colors.push(color);
        normals.push(boxNormals[i]);
        texCoords.push(boxTexCoords[i]);
    }
    
    const faces = [
        0, 1, 2,   0, 2, 3,
        5, 4, 7,   5, 7, 6,
        4, 0, 3,   4, 3, 7,
        1, 5, 6,   1, 6, 2,
        3, 2, 6,   3, 6, 7,
        4, 5, 1,   4, 1, 0
    ];
    
    for (var f = 0; f < faces.length; f++) {
        indices.push(startIndex + faces[f]);
    }
}

function setupBuffers() {
    if (vBuffer) gl.deleteBuffer(vBuffer);
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    if (cBuffer) gl.deleteBuffer(cBuffer);
    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);
    
    if (nBuffer) gl.deleteBuffer(nBuffer);
    nBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(normals), gl.STATIC_DRAW);
    
    var vNormal = gl.getAttribLocation(program, "vNormal");
    gl.vertexAttribPointer(vNormal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vNormal);
    
    if (tBuffer) gl.deleteBuffer(tBuffer);
    tBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(texCoords), gl.STATIC_DRAW);
    
    var vTexCoord = gl.getAttribLocation(program, "vTexCoord");
    gl.vertexAttribPointer(vTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vTexCoord);
    
    if (iBuffer) gl.deleteBuffer(iBuffer);
    iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

function updateBuffers() {
    createFloorSocket();
    if (showGrid) createGrid();
    
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

function setupEventListeners() {
    canvas.addEventListener("mousedown", function(event) {
        mouseDown = true;
        mouseButton = event.button;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
    });
    
    canvas.addEventListener("mouseup", function(event) {
        mouseDown = false;
    });
    
    canvas.addEventListener("mousemove", function(event) {
        if (!mouseDown) return;
        
        var deltaX = event.clientX - lastMouseX;
        var deltaY = event.clientY - lastMouseY;
        
        if (mouseButton === 0) { 
            cameraRotation.y -= deltaX * 0.5;
            cameraRotation.x += deltaY * 0.5;
            cameraRotation.x = Math.max(-89, Math.min(89, cameraRotation.x));
        } else if (mouseButton === 2) { 
            translation.x -= deltaX * 0.01;
            translation.y += deltaY * 0.01;
        }
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
    });
    
    canvas.addEventListener("wheel", function(event) {
        zoom += event.deltaY * 0.01;
        zoom = Math.max(1, Math.min(20, zoom));
        updateProjectionMatrix();
        event.preventDefault();
    });
    
    canvas.addEventListener("contextmenu", function(event) {
        event.preventDefault();
    });
}

function setupControlListeners() {
    ["scaleX", "scaleY", "scaleZ"].forEach(function(id) {
        var slider = document.getElementById(id);
        var display = document.getElementById(id + "-value");
        slider.addEventListener("input", function() {
            scaling[id.substr(5).toLowerCase()] = parseFloat(this.value);
            display.textContent = this.value;
        });
    });
    
    ["rotX", "rotY", "rotZ"].forEach(function(id) {
        var slider = document.getElementById(id);
        var display = document.getElementById(id + "-value");
        slider.addEventListener("input", function() {
            objectRotation[id.substr(3).toLowerCase()] = parseFloat(this.value);
            display.textContent = this.value + "°";
        });
    });
    
    var coverSlider = document.getElementById("coverAngle");
    var coverDisplay = document.getElementById("coverAngle-value");
    coverSlider.addEventListener("input", function() {
        coverAngle = parseFloat(this.value);
        coverAngle = Math.max(0, Math.min(COVER_MAX_ANGLE, coverAngle));
        coverDisplay.textContent = this.value + "°";
        updateBuffers();
    });
}

function openSocket() {
    isOpening = true;
    isClosing = false;
    document.getElementById("openBtn").classList.add("active");
    document.getElementById("closeBtn").classList.remove("active");
}

function closeSocket() {
    isClosing = true;
    isOpening = false;
    document.getElementById("closeBtn").classList.add("active");
    document.getElementById("openBtn").classList.remove("active");
}

function resetAnimation() {
    coverAngle = 0;
    isOpening = false;
    isClosing = false;
    document.getElementById("coverAngle").value = "0";
    document.getElementById("coverAngle-value").textContent = "0°";
    document.getElementById("openBtn").classList.remove("active");
    document.getElementById("closeBtn").classList.remove("active");
    updateBuffers();
}

function resetTransform() {
    scaling = { x: 1, y: 1, z: 1 };
    objectRotation = { x: 0, y: 0, z: 0 };
    translation = { x: 0, y: 0, z: 0};
    
    document.getElementById("scaleX").value = "1.0";
    document.getElementById("scaleY").value = "1.0";
    document.getElementById("scaleZ").value = "1.0";
    document.getElementById("scaleX-value").textContent = "1.0";
    document.getElementById("scaleY-value").textContent = "1.0";
    document.getElementById("scaleZ-value").textContent = "1.0";
    
    document.getElementById("rotX").value = "0";
    document.getElementById("rotY").value = "0";
    document.getElementById("rotZ").value = "0";
    document.getElementById("rotX-value").textContent = "0°";
    document.getElementById("rotY-value").textContent = "0°";
    document.getElementById("rotZ-value").textContent = "0°";
}

function toggleGrid() {
    showGrid = !showGrid;
    updateBuffers();
}

function toggleWireframe() {
    wireframe = !wireframe;
}

function toggleProjection() {
    orthographic = !orthographic;
    updateProjectionMatrix();
}

function animateRotationX() {
    animationActive = true;
    animationAxis = 'x';
}

function animateRotationY() {
    animationActive = true;
    animationAxis = 'y';
}

function animateRotationZ() {
    animationActive = true;
    animationAxis = 'z';
}

function stopRotation() {
    animationActive = false;
    animationAxis = null;
}

function updateAnimation() {
    var needsUpdate = false;
    
    if (isOpening && coverAngle < COVER_MAX_ANGLE) {
        coverAngle += openSpeed;
        if (coverAngle >= COVER_MAX_ANGLE) {
            coverAngle = COVER_MAX_ANGLE;
            isOpening = false;
            document.getElementById("openBtn").classList.remove("active");
        }
        needsUpdate = true;
    }
    
    if (isClosing && coverAngle > 0) {
        coverAngle -= openSpeed;
        if (coverAngle <= 0) {
            coverAngle = 0;
            isClosing = false;
            document.getElementById("closeBtn").classList.remove("active");
        }
        needsUpdate = true;
    }
    
    if (needsUpdate) {
        document.getElementById("coverAngle").value = coverAngle.toString();
        document.getElementById("coverAngle-value").textContent = Math.round(coverAngle) + "°";
        updateBuffers();
    }
    
    if (animationActive && animationAxis) {
        objectRotation[animationAxis] = (objectRotation[animationAxis] + animationSpeed) % 360;
        
        var slider = document.getElementById("rot" + animationAxis.toUpperCase());
        var display = document.getElementById("rot" + animationAxis.toUpperCase() + "-value");
        if (slider && display) {
            slider.value = objectRotation[animationAxis];
            display.textContent = Math.round(objectRotation[animationAxis]) + "°";
        }
    }
}

function normalMatrixFromMat4(m) {
    var upper = mat3();
    for (var i = 0; i < 3; ++i) {
        for (var j = 0; j < 3; ++j) {
            upper[i][j] = m[i][j];
        }
    }
    return inverse(transpose(upper));
}

function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    updateAnimation();
    
    var camX = zoom * Math.cos(radians(cameraRotation.x)) * Math.sin(radians(cameraRotation.y));
    var camY = zoom * Math.sin(radians(cameraRotation.x));
    var camZ = zoom * Math.cos(radians(cameraRotation.x)) * Math.cos(radians(cameraRotation.y));
    
    eye = vec3(camX, camY, camZ);
    at = vec3(0, 0, 0);
    
    var viewMatrix = lookAt(eye, at, up);
    
    var transformMatrix = mat4();
    transformMatrix = mult(transformMatrix, rotateX(objectRotation.x));
    transformMatrix = mult(transformMatrix, rotateY(objectRotation.y));
    transformMatrix = mult(transformMatrix, rotateZ(objectRotation.z));
    transformMatrix = mult(transformMatrix, scale(scaling.x, scaling.y, scaling.z));
    transformMatrix = mult(transformMatrix, translate(translation.x, translation.y, translation.z));
    
    modelViewMatrix = mult(viewMatrix, transformMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    
    var normalMatrix = normalMatrixFromMat4(modelViewMatrix);
    gl.uniformMatrix3fv(normalMatrixLoc, false, flatten(normalMatrix));

    // Transform light position to eye/view space (not model space)
    var lightPosVec4 = vec4(lightPosition[0], lightPosition[1], lightPosition[2], 1.0);
    var lightPosEyeSpace = mult(viewMatrix, lightPosVec4);
    var lightPosEye = vec3(lightPosEyeSpace[0], lightPosEyeSpace[1], lightPosEyeSpace[2]);
    
    gl.uniform3fv(ambientLightLoc, flatten(ambientColor));
    gl.uniform3fv(diffuseLightLoc, flatten(diffuseColor));
    gl.uniform3fv(specularLightLoc, flatten(specularColor));
    gl.uniform3fv(lightPositionLoc, flatten(lightPosEye));
    gl.uniform1f(shininessLoc, shininess);
    gl.uniform1i(enableLightingLoc, lightingEnabled ? 1 : 0);
    
    // Set texture uniforms
    gl.activeTexture(gl.TEXTURE0);
    if (textureMode > 0 && currentTexture) {
        gl.bindTexture(gl.TEXTURE_2D, currentTexture);
    }
    gl.uniform1i(textureLoc, 0);
    gl.uniform1i(textureModeLoc, textureMode);
    gl.uniform1i(useTextureLoc, useTexture ? 1 : 0);
    
    const objectIndexCount = indices.length;
    let gridVertexCount = 0;
    
    if(showGrid) {
        const totalGridLines = (10 * 2 + 1) * 2;
        gridVertexCount = totalGridLines * 2;
    }
    const solidObjectVertexCount = vertices.length - gridVertexCount;

    if (wireframe) {
        gl.drawElements(gl.LINES, objectIndexCount, gl.UNSIGNED_SHORT, 0);
    } else {
        gl.drawElements(gl.TRIANGLES, objectIndexCount, gl.UNSIGNED_SHORT, 0);
    }
    
    if (showGrid) {
        gl.drawArrays(gl.LINES, solidObjectVertexCount, gridVertexCount);
    }
    
    requestAnimationFrame(render);
}