// initShaders.js - WebGL shader initialization utilities

function initShaders(gl, vertexShaderId, fragmentShaderId) {
    var vertexShader;
    var fragmentShader;

    var vertexElement = document.getElementById(vertexShaderId);
    if (!vertexElement) { 
        // If no element found, use default vertex shader
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, getDefaultVertexShader());
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            alert("Vertex shader failed to compile: " + gl.getShaderInfoLog(vertexShader));
            return null;
        }
    } else {
        vertexShader = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vertexShader, vertexElement.text);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            alert("Vertex shader failed to compile: " + gl.getShaderInfoLog(vertexShader));
            return null;
        }
    }

    var fragmentElement = document.getElementById(fragmentShaderId);
    if (!fragmentElement) {
        // If no element found, use default fragment shader
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, getDefaultFragmentShader());
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            alert("Fragment shader failed to compile: " + gl.getShaderInfoLog(fragmentShader));
            return null;
        }
    } else {
        fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fragmentShader, fragmentElement.text);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            alert("Fragment shader failed to compile: " + gl.getShaderInfoLog(fragmentShader));
            return null;
        }
    }

    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert("Could not initialize shaders: " + gl.getProgramInfoLog(program));
        return null;
    }

    return program;
}

function getDefaultVertexShader() {
    return `
        attribute vec4 vPosition;
        attribute vec4 vColor;
        
        uniform mat4 modelViewMatrix;
        uniform mat4 projectionMatrix;
        
        varying vec4 fColor;
        
        void main() {
            fColor = vColor;
            gl_Position = projectionMatrix * modelViewMatrix * vPosition;
        }
    `;
}

function getDefaultFragmentShader() {
    return `
        precision mediump float;
        
        varying vec4 fColor;
        
        void main() {
            gl_FragColor = fColor;
        }
    `;
}

// WebGL utility functions
var WebGLUtils = function() {

    var makeFailHTML = function(msg) {
        return '' +
            '<div style="margin: auto; width:500px;z-index:10000;margin-top:20em;text-align:center;">' + msg + '</div>';
    };

    var GET_A_WEBGL_BROWSER = '' +
        'This page requires a browser that supports WebGL.<br/>' +
        '<a href="http://get.webgl.org">Click here to upgrade your browser.</a>';

    var OTHER_PROBLEM = '' +
        "It doesn't appear your computer can support WebGL.<br/>" +
        '<a href="http://get.webgl.org">Click here for more information.</a>';

    var setupWebGL = function(canvas, opt_attribs, opt_onError) {
        function handleCreationError(msg) {
            var container = document.getElementsByTagName("body")[0];
            if (container) {
                container.innerHTML = makeFailHTML(msg);
            }
        }

        opt_onError = opt_onError || handleCreationError;

        if (canvas.addEventListener) {
            canvas.addEventListener("webglcontextcreationerror", function(event) {
                opt_onError(OTHER_PROBLEM);
            }, false);
        }
        var context = create3DContext(canvas, opt_attribs);
        if (!context) {
            if (!window.WebGLRenderingContext) {
                opt_onError(GET_A_WEBGL_BROWSER);
            } else {
                opt_onError(OTHER_PROBLEM);
            }
        }
        return context;
    };

    var create3DContext = function(canvas, opt_attribs) {
        var names = ["webgl", "experimental-webgl", "webkit-3d", "moz-webgl"];
        var context = null;
        for (var ii = 0; ii < names.length; ++ii) {
            try {
                context = canvas.getContext(names[ii], opt_attribs);
            } catch(e) {}
            if (context) {
                break;
            }
        }
        return context;
    }

    return {
        create3DContext: create3DContext,
        setupWebGL: setupWebGL
    };
}();