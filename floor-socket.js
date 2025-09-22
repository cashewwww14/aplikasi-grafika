// ====================================================================
// FLOOR SOCKET 3D VISUALIZATION
// Visualisasi 3D dari floor socket listrik dengan mekanisme pop-up
// ====================================================================

// ====================================================================
// VARIABEL GLOBAL
// ====================================================================

// Canvas dan WebGL
var canvas;
var gl;
var program;

// Buffer untuk vertex, color, dan index
var vBuffer, cBuffer, iBuffer;

// Lokasi uniform untuk matrix transformasi
var modelViewMatrixLoc, projectionMatrixLoc;

// Matrix transformasi
var modelViewMatrix = mat4();
var projectionMatrix;

// ====================================================================
// SISTEM KAMERA DAN INTERAKSI
// ====================================================================

// Parameter kamera tetap
var eye = vec3(3, 3, 3);
var at = vec3(0, 0, 0);
var up = vec3(0, 1, 0);

// Status mouse dan interaksi
var mouseDown = false;
var mouseButton = 0;
var lastMouseX = 0;
var lastMouseY = 0;

// Sistem rotasi terpisah untuk kamera dan objek
var cameraRotation = { x: 30, y: -45 }; // Sudut awal kamera
var objectRotation = { x: 0, y: 0, z: 0 };
var translation = { x: 0, y: 0, z: 0 };
var scaling = { x: 1, y: 1, z: 1 };
var zoom = 5;

// ====================================================================
// STATUS ANIMASI DAN KONTROL
// ====================================================================

// Animasi penutup socket
var coverAngle = 0;
var isOpening = false;
var isClosing = false;
var openSpeed = 2.5; // derajat per frame

// Kontrol tampilan
var showGrid = true;
var wireframe = false;

// Animasi rotasi otomatis
var animationActive = false;
var animationAxis = null;
var animationSpeed = 2;

// ====================================================================
// DATA GEOMETRI
// ====================================================================

// Array untuk menyimpan vertex, warna, dan indeks
var vertices = [];
var colors = [];
var indices = [];

// Konstanta batas
var COVER_MAX_ANGLE = 85; // Sudut buka maksimal agar lebih realistis

// ====================================================================
// INISIALISASI APLIKASI
// ====================================================================

window.onload = function init() {
    // Setup canvas dan WebGL
    canvas = document.getElementById("gl-canvas");
    
    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) {
        alert("WebGL isn't available");
        return;
    }

    // Konfigurasi WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.enable(gl.DEPTH_TEST);

    // Buat geometri floor socket
    createFloorSocket();
    
    // Buat grid lantai
    createGrid();

    // Load dan setup shader
    program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Setup buffer WebGL
    setupBuffers();

    // Dapatkan lokasi uniform variable
    modelViewMatrixLoc = gl.getUniformLocation(program, "modelViewMatrix");
    projectionMatrixLoc = gl.getUniformLocation(program, "projectionMatrix");

    // Setup projection matrix
    projectionMatrix = perspective(45, canvas.width/canvas.height, 0.1, 100);
    gl.uniformMatrix4fv(projectionMatrixLoc, false, flatten(projectionMatrix));

    // Setup event listener untuk interaksi mouse
    setupEventListeners();

    // Setup listener untuk kontrol UI
    setupControlListeners();

    // Mulai rendering loop
    render();
};

// ====================================================================
// FUNGSI PEMBUATAN GEOMETRI UTAMA
// ====================================================================

/**
 * Fungsi utama untuk membuat seluruh geometri floor socket.
 * Terdiri dari: base frame, recess, tombol, dan mekanisme pop-up
 */
function createFloorSocket() {
    // Reset array geometri
    vertices = [];
    colors = [];
    indices = [];
    
    // Definisi warna komponen
    const baseColor = [0.75, 0.75, 0.78, 1.0];        // Silver metalik untuk base
    const recessColor = [0.4, 0.4, 0.4, 1.0];         // Abu-abu gelap untuk recess
    const popUpBodyColor = [0.5, 0.5, 0.5, 1.0];      // Abu-abu untuk bodi pop-up
    const socketPanelColor = [0.95, 0.95, 0.95, 1.0]; // Putih gading untuk panel
    const socketHoleColor = [0.1, 0.1, 0.1, 1.0];     // Hitam untuk lubang
    const buttonColor = [0.6, 0.6, 0.6, 1.0];         // Abu-abu tombol

    // Dimensi komponen (proporsional dengan referensi)
    const baseWidth = 2.0;
    const baseDepth = 1.6;
    const baseHeight = 0.2;
    const bevelSize = 0.1;

    const popUpWidth = baseWidth - 0.6;
    const popUpDepth = baseDepth - 0.4;
    const popUpHeight = popUpDepth * 0.9; // Tinggi wedge

    // 1. Base Frame (rangka luar dengan bevel)
    addBaseFrame(0, 0, 0, baseWidth, baseDepth, baseHeight, bevelSize, baseColor);
    
    // 2. Recess (bagian dalam yang lebih rendah)
    addBox(0, baseHeight/2 - 0.01, 0, baseWidth - bevelSize*2, 0.02, baseDepth - bevelSize*2, recessColor);

    // 3. Tombol pembuka dengan indikator segitiga
    const buttonZPos = -(baseDepth / 2) + 0.2;
    addBox(0, baseHeight / 2, buttonZPos, 0.5, 0.02, 0.15, buttonColor);
    addTriangle(0, baseHeight / 2 + 0.011, buttonZPos, 0.1, 0.07, [0.3, 0.3, 0.3, 1.0]);

    // 4. Mekanisme Pop-up dengan sistem engsel
    const hingeZPosition = (popUpDepth / 2); // Posisi engsel di belakang
    
    if (coverAngle === 0) {
        // Kondisi tertutup: tampilkan penutup rata
        addBox(0, baseHeight / 2 - 0.1, 0, popUpWidth, 0.02, popUpDepth, baseColor);
    } else {
        // Kondisi terbuka: tampilkan mekanisme wedge yang dirotasi
        addPopUpMechanism(0, baseHeight/2, 0, popUpWidth, popUpDepth, popUpHeight, 
                         90 - coverAngle, hingeZPosition, popUpBodyColor, socketPanelColor, socketHoleColor);
    }
}

/**
 * Membuat base frame dengan bevel (sisi miring) yang akurat.
 * Frame ini adalah bagian luar socket yang menempel pada lantai.
 */
function addBaseFrame(x, y, z, width, depth, height, bevel, color) {
    const startIndex = vertices.length;

    // Kalkulasi dimensi
    const w2 = width / 2;
    const d2 = depth / 2;
    const h2 = height / 2;
    const bw = w2 - bevel; // lebar dalam
    const bd = d2 - bevel; // kedalaman dalam

    // 16 vertex: 8 untuk bagian bawah (luar), 8 untuk bagian atas (dalam)
    const frameVertices = [
        // Bagian bawah (level lantai) - 8 vertex luar
        vec4(x - w2, y - h2, z + d2, 1.0), // 0
        vec4(x + w2, y - h2, z + d2, 1.0), // 1
        vec4(x + w2, y - h2, z - d2, 1.0), // 2
        vec4(x - w2, y - h2, z - d2, 1.0), // 3
        
        // Bagian atas (level socket) - 8 vertex dalam
        vec4(x - bw, y + h2, z + bd, 1.0), // 4
        vec4(x + bw, y + h2, z + bd, 1.0), // 5
        vec4(x + bw, y + h2, z - bd, 1.0), // 6
        vec4(x - bw, y + h2, z - bd, 1.0), // 7
    ];

    // Warna berbeda untuk sisi belakang (lebih gelap)
    const backColor = [0.6, 0.6, 0.65, 1.0];
    
    // Tambahkan vertex dan warna
    for (let i = 0; i < frameVertices.length; i++) {
        vertices.push(frameVertices[i]);
        // Vertex 2, 3, 6, 7 adalah sisi belakang
        if (i === 2 || i === 3 || i === 6 || i === 7) {
            colors.push(backColor);
        } else {
            colors.push(color);
        }
    }

    // Definisi face dengan triangle
    const frameIndices = [
        // Atas (permukaan socket)
        4, 5, 6, 4, 6, 7,
        // Depan (bevel miring)
        0, 1, 5, 0, 5, 4,
        // Kanan (bevel miring)
        1, 2, 6, 1, 6, 5,
        // Belakang (bevel miring)
        2, 3, 7, 2, 7, 6,
        // Kiri (bevel miring)
        3, 0, 4, 3, 4, 7,
        // Bawah (tidak terlihat, tapi baik untuk kelengkapan)
        0, 3, 2, 0, 2, 1
    ];

    // Tambahkan indeks dengan offset
    for (let i = 0; i < frameIndices.length; i++) {
        indices.push(startIndex + frameIndices[i]);
    }
}

/**
 * Membuat mekanisme pop-up yang kompleks.
 * Terdiri dari: wedge (baji), panel belakang, panel socket, dan lubang socket.
 * Semua komponen dirotasi bersama-sama menggunakan sistem engsel.
 */
function addPopUpMechanism(x, y, z, width, depth, height, angle, hingeZ, bodyColor, panelColor, holeColor) {
    const startIndex = vertices.length;
    let currentVertex = 0;

    // Array lokal untuk vertex, warna, dan indeks (sebelum transformasi)
    const localVertices = [];
    const localColors = [];
    const localIndices = [];

    const w2 = width / 2;
    const d2 = depth / 2;

    // ===== 1. WEDGE (BAJI) =====
    // Bentuk baji adalah dasar mekanisme pop-up
    localVertices.push(
        vec4(-w2, 0, -d2, 1.0), vec4( w2, 0, -d2, 1.0),  // Bagian depan bawah
        vec4( w2, 0,  d2, 1.0), vec4(-w2, 0,  d2, 1.0),  // Bagian belakang bawah
        vec4(-w2, height, d2, 1.0), vec4( w2, height, d2, 1.0)  // Bagian belakang atas
    );
    
    // Warna untuk wedge
    for(let i=0; i<6; i++) localColors.push(bodyColor);

    // Indeks untuk membentuk triangle face wedge
    localIndices.push(
        0, 1, 2,   0, 2, 3,   // Bottom face
        3, 2, 5,   3, 5, 4,   // Back face (miring)
        0, 4, 5,   0, 5, 1,   // Top face (miring)
        0, 3, 4,   1, 5, 2    // Side faces
    );
    currentVertex += 6;

    // ===== 2. PANEL BELAKANG (BIDANG PERSEGI PANJANG) =====
    // Panel belakang memberikan struktur tambahan pada mekanisme
    const backPanelColor = [
        Math.min(1.0, bodyColor[0] + 0.3), 
        Math.min(1.0, bodyColor[1] + 0.3), 
        Math.min(1.0, bodyColor[2] + 0.3), 
        1.0
    ];
    
    // Dimensi panel belakang (lebih besar dari wedge)
    const panelWidth = width * 1.2;
    const panelHeight = height * 1.05;
    const panelW2 = panelWidth / 2;
    
    // Posisi dan ketebalan panel
    const backZOffset = d2;
    const panelThickness = 0.05;
    
    // 8 vertex untuk box panel belakang
    // Front face (menghadap wedge)
    localVertices.push(
        vec4(-panelW2, 0, backZOffset, 1.0),                           // 6
        vec4( panelW2, 0, backZOffset, 1.0),                           // 7
        vec4( panelW2, panelHeight, backZOffset, 1.0),                 // 8
        vec4(-panelW2, panelHeight, backZOffset, 1.0)                  // 9
    );
    
    // Back face (sisi yang terlihat dari belakang)
    localVertices.push(
        vec4(-panelW2, 0, backZOffset + panelThickness, 1.0),          // 10
        vec4( panelW2, 0, backZOffset + panelThickness, 1.0),          // 11
        vec4( panelW2, panelHeight, backZOffset + panelThickness, 1.0), // 12
        vec4(-panelW2, panelHeight, backZOffset + panelThickness, 1.0)  // 13
    );
    
    // Warna untuk semua vertex panel belakang
    for(let i = 0; i < 8; i++) {
        localColors.push(backPanelColor);
    }
    
    // Indeks untuk membentuk box panel belakang
    const backStart = currentVertex;
    localIndices.push(
        // Front face
        backStart, backStart + 1, backStart + 2,
        backStart, backStart + 2, backStart + 3,
        // Back face
        backStart + 4, backStart + 7, backStart + 6,
        backStart + 4, backStart + 6, backStart + 5,
        // Bottom face
        backStart, backStart + 4, backStart + 5,
        backStart, backStart + 5, backStart + 1,
        // Top face
        backStart + 2, backStart + 6, backStart + 7,
        backStart + 2, backStart + 7, backStart + 3,
        // Left face
        backStart + 3, backStart + 7, backStart + 4,
        backStart + 3, backStart + 4, backStart,
        // Right face
        backStart + 1, backStart + 5, backStart + 6,
        backStart + 1, backStart + 6, backStart + 2
    );
    
    currentVertex += 8;

    // ===== 3. PANEL SOCKET PUTIH =====
    // Panel tempat socket listrik berada
    const panelOffset = -0.01;
    
    // Hitung posisi 4 corner panel pada permukaan wedge
    const p_bl = mix(localVertices[0], localVertices[4], 0.15);  // bottom-left
    const p_br = mix(localVertices[1], localVertices[5], 0.15);  // bottom-right
    const p_tr = mix(localVertices[1], localVertices[5], 0.85);  // top-right
    const p_tl = mix(localVertices[0], localVertices[4], 0.85);  // top-left
    
    // Hitung normal vector untuk offset panel
    let normal = cross(subtract(p_br, p_bl), subtract(p_tl, p_bl));
    normal = normalize(normal);
    const offsetVec = scale(panelOffset, vec4(normal[0], normal[1], normal[2], 0));

    // Tambahkan vertex panel dengan offset
    localVertices.push(
        add(p_bl, offsetVec), add(p_br, offsetVec),
        add(p_tr, offsetVec), add(p_tl, offsetVec)
    );
    
    // Warna panel socket (putih gading)
    for(let i=0; i<4; i++) localColors.push(panelColor);
    
    // Indeks untuk quad panel
    localIndices.push(
        currentVertex, currentVertex + 1, currentVertex + 2,
        currentVertex, currentVertex + 2, currentVertex + 3
    );
    currentVertex += 4;
    
    // ===== 4. LUBANG SOCKET BULAT (TIPE F) =====
    // Dua lubang bundar horizontal untuk socket tipe F (standar Eropa)
    
    // Offset agar lubang terlihat di depan panel (hindari Z-fighting)
    const holeVisibleOffset = -0.005; 
    const socketHoleOffsetVec = scale(panelOffset + holeVisibleOffset, vec4(normal[0], normal[1], normal[2], 0));
    
    // Parameter lubang
    const holeRadius = 0.04;
    const holeSegments = 15; // Resolusi lingkaran

    // Posisi pusat socket di sisi kiri panel
    const leftSocketCenterX = 0.7;
    const socketCenterPoint = add(
        mix(
            mix(p_bl, p_br, leftSocketCenterX), 
            mix(p_tl, p_tr, leftSocketCenterX), 
            0.5 // Posisi vertikal tengah
        ), 
        socketHoleOffsetVec
    );

    // Vektor arah untuk menggambar lingkaran pada panel miring
    const panelRightVec = normalize(subtract(p_br, p_bl));
    const panelUpVec = normalize(subtract(p_tl, p_bl));
    
    // Jarak antar lubang
    const holeSeparation = 0.1;

    // Posisi kedua lubang (kiri dan kanan dari pusat)
    const leftHoleCenter = subtract(socketCenterPoint, scale(holeSeparation, panelRightVec));
    const rightHoleCenter = add(socketCenterPoint, scale(holeSeparation, panelRightVec));

    // Fungsi helper untuk membuat satu lingkaran
    const createCircle = (center) => {
        const centerIndex = currentVertex;
        
        // Tambah titik pusat lingkaran
        localVertices.push(center);
        localColors.push(holeColor);
        currentVertex++;
        
        // Buat vertex di sekeliling lingkaran
        for (let i = 0; i <= holeSegments; i++) {
            const angle = (i / holeSegments) * 2 * Math.PI;
            const x_comp = scale(holeRadius * Math.cos(angle), panelRightVec);
            const y_comp = scale(holeRadius * Math.sin(angle), panelUpVec);
            localVertices.push(add(add(center, x_comp), y_comp));
            localColors.push(holeColor);
        }
        
        // Buat triangle fan untuk mengisi lingkaran
        for (let i = 0; i < holeSegments; i++) {
            localIndices.push(centerIndex, currentVertex + i, currentVertex + i + 1);
        }
        currentVertex += (holeSegments + 1);
    };

    // Gambar kedua lingkaran socket
    createCircle(leftHoleCenter);
    createCircle(rightHoleCenter);

    // ===== TRANSFORMASI DAN PENAMBAHAN KE BUFFER GLOBAL =====
    // Terapkan rotasi engsel pada semua vertex lokal
    const rotMatrix = rotateX(-angle);
    
    for (let i = 0; i < localVertices.length; i++) {
        let v = vec4(localVertices[i]);
        
        // Translasi ke origin untuk rotasi engsel
        v[2] -= hingeZ;
        
        // Terapkan rotasi
        v = mult(rotMatrix, v);
        
        // Translasi kembali ke posisi engsel
        v[2] += hingeZ;
        
        // Terapkan transformasi global
        v[0] += x; 
        v[1] += y; 
        v[2] += z;
        
        // Tambahkan ke buffer global
        vertices.push(v);
        colors.push(localColors[i]);
    }
    
    // Tambahkan semua indeks ke buffer global
    for(let i=0; i<localIndices.length; i++) {
        indices.push(startIndex + localIndices[i]);
    }
}

// ====================================================================
// FUNGSI HELPER GEOMETRI
// ====================================================================

/**
 * Membuat segitiga indikator pada tombol.
 * Segitiga menunjuk ke arah buka socket.
 */
function addTriangle(x, y, z, width, height, color) {
    const startIndex = vertices.length;
    const w2 = width / 2;
    
    // Vertex segitiga (menunjuk ke bawah/depan)
    vertices.push(vec4(x, y, z - height/2, 1.0));      // Puncak
    vertices.push(vec4(x + w2, y, z + height/2, 1.0)); // Kanan bawah
    vertices.push(vec4(x - w2, y, z + height/2, 1.0)); // Kiri bawah
    
    // Warna seragam untuk segitiga
    for(var i=0; i<3; i++) colors.push(color);
    
    // Indeks triangle
    indices.push(startIndex, startIndex+1, startIndex+2);
}

/**
 * Membuat grid lantai untuk referensi visual.
 * Grid membantu memahami skala dan orientasi objek.
 */
function createGrid() {
    var gridSize = 10;      // Ukuran grid (10x10)
    var gridStep = 0.5;     // Jarak antar garis
    var gridColor = [0.7, 0.7, 0.7, 1.0]; // Abu-abu terang

    // Array terpisah untuk grid (tidak menggunakan indeks)
    var gridVertices = [];
    var gridColors = [];
    
    // Garis sejajar sumbu X (horizontal)
    for (var i = -gridSize; i <= gridSize; i++) {
        var z_pos = i * gridStep;
        gridVertices.push(vec4(-gridSize * gridStep, 0, z_pos, 1.0));
        gridVertices.push(vec4(gridSize * gridStep, 0, z_pos, 1.0));
        gridColors.push(gridColor);
        gridColors.push(gridColor);
    }
    
    // Garis sejajar sumbu Z (vertikal)
    for (var i = -gridSize; i <= gridSize; i++) {
        var x_pos = i * gridStep;
        gridVertices.push(vec4(x_pos, 0, -gridSize * gridStep, 1.0));
        gridVertices.push(vec4(x_pos, 0, gridSize * gridStep, 1.0));
        gridColors.push(gridColor);
        gridColors.push(gridColor);
    }

    // Gabungkan dengan buffer utama
    vertices.push(...gridVertices);
    colors.push(...gridColors);
}

/**
 * Membuat box/kotak sederhana.
 * Digunakan untuk komponen dasar seperti base, recess, tombol.
 */
function addBox(x, y, z, width, height, depth, color) {
    const startIndex = vertices.length;
    
    // Kalkulasi setengah dimensi
    const w2 = width / 2;
    const h2 = height / 2;
    const d2 = depth / 2;
    
    // 8 vertex box standar
    const boxVertices = [
        vec4(x - w2, y - h2, z + d2, 1.0), vec4(x + w2, y - h2, z + d2, 1.0), // Bottom front
        vec4(x + w2, y + h2, z + d2, 1.0), vec4(x - w2, y + h2, z + d2, 1.0), // Top front
        vec4(x - w2, y - h2, z - d2, 1.0), vec4(x + w2, y - h2, z - d2, 1.0), // Bottom back
        vec4(x + w2, y + h2, z - d2, 1.0), vec4(x - w2, y + h2, z - d2, 1.0)  // Top back
    ];
    
    // Tambahkan vertex dan warna
    for (var i = 0; i < boxVertices.length; i++) {
        vertices.push(boxVertices[i]);
        colors.push(color);
    }
    
    // Definisi 12 triangle untuk 6 face box
    const faces = [
        0, 1, 2,   0, 2, 3, // front
        5, 4, 7,   5, 7, 6, // back
        4, 0, 3,   4, 3, 7, // left
        1, 5, 6,   1, 6, 2, // right
        3, 2, 6,   3, 6, 7, // top
        4, 5, 1,   4, 1, 0  // bottom
    ];
    
    // Tambahkan indeks dengan offset
    for (var f = 0; f < faces.length; f++) {
        indices.push(startIndex + faces[f]);
    }
}

// ====================================================================
// SETUP BUFFER DAN WEBGL
// ====================================================================

/**
 * Setup buffer WebGL untuk vertex, color, dan index.
 */
function setupBuffers() {
    // Vertex buffer
    if (vBuffer) gl.deleteBuffer(vBuffer);
    vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);
    
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    
    // Color buffer
    if (cBuffer) gl.deleteBuffer(cBuffer);
    cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);
    
    // Index buffer
    if (iBuffer) gl.deleteBuffer(iBuffer);
    iBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

/**
 * Update buffer WebGL dengan data geometri terbaru.
 * Dipanggil saat geometri berubah (animasi buka/tutup).
 */
function updateBuffers() {
    // Regenerate geometri
    createFloorSocket();
    if (showGrid) createGrid();
    
    // Update vertex buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(vertices), gl.STATIC_DRAW);

    // Update color buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);
    
    // Update index buffer
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, iBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
}

// ====================================================================
// EVENT LISTENER DAN KONTROL INTERAKSI
// ====================================================================

/**
 * Setup event listener untuk interaksi mouse.
 * Mendukung: rotasi kamera (klik kiri), pan (klik kanan), zoom (scroll).
 */
function setupEventListeners() {
    // Mouse down - mulai interaksi
    canvas.addEventListener("mousedown", function(event) {
        mouseDown = true;
        mouseButton = event.button;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
    });
    
    // Mouse up - akhiri interaksi
    canvas.addEventListener("mouseup", function(event) {
        mouseDown = false;
    });
    
    // Mouse move - proses drag
    canvas.addEventListener("mousemove", function(event) {
        if (!mouseDown) return;
        
        var deltaX = event.clientX - lastMouseX;
        var deltaY = event.clientY - lastMouseY;
        
        if (mouseButton === 0) { 
            // Klik kiri - rotasi kamera
            cameraRotation.y -= deltaX * 0.5;
            cameraRotation.x += deltaY * 0.5;
            cameraRotation.x = Math.max(-89, Math.min(89, cameraRotation.x));
        } else if (mouseButton === 2) { 
            // Klik kanan - pan kamera
            translation.x -= deltaX * 0.01;
            translation.y += deltaY * 0.01;
        }
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        event.preventDefault();
    });
    
    // Mouse wheel - zoom kamera
    canvas.addEventListener("wheel", function(event) {
        zoom += event.deltaY * 0.01;
        zoom = Math.max(1, Math.min(20, zoom));
        event.preventDefault();
    });
    
    // Disable context menu pada klik kanan
    canvas.addEventListener("contextmenu", function(event) {
        event.preventDefault();
    });
}

/**
 * Setup listener untuk kontrol UI (slider dan tombol).
 */
function setupControlListeners() {
    // Kontrol scaling (X, Y, Z)
    ["scaleX", "scaleY", "scaleZ"].forEach(function(id) {
        var slider = document.getElementById(id);
        var display = document.getElementById(id + "-value");
        slider.addEventListener("input", function() {
            scaling[id.substr(5).toLowerCase()] = parseFloat(this.value);
            display.textContent = this.value;
        });
    });
    
    // Kontrol rotasi objek (terpisah dari rotasi kamera)
    ["rotX", "rotY", "rotZ"].forEach(function(id) {
        var slider = document.getElementById(id);
        var display = document.getElementById(id + "-value");
        slider.addEventListener("input", function() {
            objectRotation[id.substr(3).toLowerCase()] = parseFloat(this.value);
            display.textContent = this.value + "°";
        });
    });
    
    // Kontrol sudut buka penutup socket
    var coverSlider = document.getElementById("coverAngle");
    var coverDisplay = document.getElementById("coverAngle-value");
    coverSlider.addEventListener("input", function() {
        coverAngle = parseFloat(this.value);
        coverAngle = Math.max(0, Math.min(COVER_MAX_ANGLE, coverAngle));
        coverDisplay.textContent = this.value + "°";
        updateBuffers();
    });
}

// ====================================================================
// FUNGSI ANIMASI SOCKET
// ====================================================================

/**
 * Mulai animasi membuka socket.
 */
function openSocket() {
    isOpening = true;
    isClosing = false;
    document.getElementById("openBtn").classList.add("active");
    document.getElementById("closeBtn").classList.remove("active");
}

/**
 * Mulai animasi menutup socket.
 */
function closeSocket() {
    isClosing = true;
    isOpening = false;
    document.getElementById("closeBtn").classList.add("active");
    document.getElementById("openBtn").classList.remove("active");
}

/**
 * Reset animasi socket ke kondisi tertutup.
 */
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

/**
 * Reset semua transformasi objek ke nilai default.
 */
function resetTransform() {
    // Reset nilai transformasi
    scaling = { x: 1, y: 1, z: 1 };
    objectRotation = { x: 0, y: 0, z: 0 };
    translation = { x: 0, y: 0, z: 0};
    
    // Reset UI slider scaling
    document.getElementById("scaleX").value = "1.0";
    document.getElementById("scaleY").value = "1.0";
    document.getElementById("scaleZ").value = "1.0";
    document.getElementById("scaleX-value").textContent = "1.0";
    document.getElementById("scaleY-value").textContent = "1.0";
    document.getElementById("scaleZ-value").textContent = "1.0";
    
    // Reset UI slider rotasi
    document.getElementById("rotX").value = "0";
    document.getElementById("rotY").value = "0";
    document.getElementById("rotZ").value = "0";
    document.getElementById("rotX-value").textContent = "0°";
    document.getElementById("rotY-value").textContent = "0°";
    document.getElementById("rotZ-value").textContent = "0°";
}

// ====================================================================
// FUNGSI KONTROL TAMPILAN
// ====================================================================

/**
 * Toggle tampilan grid lantai.
 */
function toggleGrid() {
    showGrid = !showGrid;
    updateBuffers();
}

/**
 * Toggle mode wireframe/solid.
 */
function toggleWireframe() {
    wireframe = !wireframe;
}

// ====================================================================
// FUNGSI ANIMASI ROTASI OTOMATIS
// ====================================================================

/**
 * Mulai animasi rotasi otomatis sumbu X.
 */
function animateRotationX() {
    animationActive = true;
    animationAxis = 'x';
}

/**
 * Mulai animasi rotasi otomatis sumbu Y.
 */
function animateRotationY() {
    animationActive = true;
    animationAxis = 'y';
}

/**
 * Mulai animasi rotasi otomatis sumbu Z.
 */
function animateRotationZ() {
    animationActive = true;
    animationAxis = 'z';
}

/**
 * Hentikan semua animasi rotasi otomatis.
 */
function stopRotation() {
    animationActive = false;
    animationAxis = null;
}

// ====================================================================
// LOOP ANIMASI DAN UPDATE
// ====================================================================

/**
 * Update semua animasi yang sedang berjalan.
 * Dipanggil setiap frame dalam render loop.
 */
function updateAnimation() {
    var needsUpdate = false;
    
    // === Animasi buka/tutup socket ===
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
    
    // Update UI dan buffer jika ada perubahan socket
    if (needsUpdate) {
        document.getElementById("coverAngle").value = coverAngle.toString();
        document.getElementById("coverAngle-value").textContent = Math.round(coverAngle) + "°";
        updateBuffers();
    }
    
    // === Animasi rotasi otomatis ===
    if (animationActive && animationAxis) {
        objectRotation[animationAxis] = (objectRotation[animationAxis] + animationSpeed) % 360;
        
        // Update UI slider yang sesuai
        var slider = document.getElementById("rot" + animationAxis.toUpperCase());
        var display = document.getElementById("rot" + animationAxis.toUpperCase() + "-value");
        if (slider && display) {
            slider.value = objectRotation[animationAxis];
            display.textContent = Math.round(objectRotation[animationAxis]) + "°";
        }
    }
}

// ====================================================================
// RENDER LOOP UTAMA
// ====================================================================

/**
 * Fungsi render utama.
 * Dipanggil setiap frame untuk menggambar scene.
 */
function render() {
    // Clear buffer
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    
    // Update animasi
    updateAnimation();
    
    // === Kalkulasi posisi kamera berdasarkan rotasi dan zoom ===
    var camX = zoom * Math.cos(radians(cameraRotation.x)) * Math.sin(radians(cameraRotation.y));
    var camY = zoom * Math.sin(radians(cameraRotation.x));
    var camZ = zoom * Math.cos(radians(cameraRotation.x)) * Math.cos(radians(cameraRotation.y));
    
    eye = vec3(camX, camY, camZ);
    at = vec3(0, 0, 0);
    
    // === Setup view matrix dengan pan ===
    var viewMatrix = lookAt(eye, at, up);
    viewMatrix = mult(translate(-translation.x, -translation.y, -translation.z), viewMatrix);
    
    // === Setup transform matrix untuk objek ===
    var transformMatrix = mat4();
    transformMatrix = mult(transformMatrix, rotateX(objectRotation.x));
    transformMatrix = mult(transformMatrix, rotateY(objectRotation.y));
    transformMatrix = mult(transformMatrix, rotateZ(objectRotation.z));
    transformMatrix = mult(transformMatrix, scale(scaling.x, scaling.y, scaling.z));
    
    // === Kombinasi view dan transform matrix ===
    modelViewMatrix = mult(viewMatrix, transformMatrix);
    gl.uniformMatrix4fv(modelViewMatrixLoc, false, flatten(modelViewMatrix));
    
    // === Hitung jumlah vertex untuk objek dan grid ===
    const objectIndexCount = indices.length;
    let gridVertexCount = 0;
    
    if(showGrid) {
        const totalGridLines = (10 * 2 + 1) * 2; // Jumlah garis grid
        gridVertexCount = totalGridLines * 2;      // Setiap garis = 2 vertex
    }
    const solidObjectVertexCount = vertices.length - gridVertexCount;

    // === Render objek solid socket ===
    if (wireframe) {
        gl.drawElements(gl.LINES, objectIndexCount, gl.UNSIGNED_SHORT, 0);
    } else {
        gl.drawElements(gl.TRIANGLES, objectIndexCount, gl.UNSIGNED_SHORT, 0);
    }
    
    // === Render grid (jika aktif) ===
    if (showGrid) {
        // Grid menggunakan drawArrays karena tidak pakai indeks
        gl.drawArrays(gl.LINES, solidObjectVertexCount, gridVertexCount);
    }
    
    // === Request frame berikutnya ===
    requestAnimationFrame(render);
}