// WebGL utilities
var WebGLUtils = (function() {
    'use strict';

    /**
     * Creates the WebGL context.
     * @param {Element} canvas The canvas element to create a context from.
     * @param {Object} opt_attribs Any creation attributes you want to pass in.
     * @return {WebGLRenderingContext} The created context.
     */
    var setupWebGL = function(canvas, opt_attribs) {
        function showLink(str) {
            var container = canvas.parentNode;
            if (container) {
                container.innerHTML = makeFailHTML(str);
            }
        }

        if (!window.WebGLRenderingContext) {
            showLink(GET_A_WEBGL_BROWSER);
            return null;
        }

        var context = create3DContext(canvas, opt_attribs);
        if (!context) {
            showLink(OTHER_PROBLEM);
        }
        return context;
    };

    /**
     * Creates a webgl context.
     * @param {Element} canvas The canvas element to create a context from.
     * @param {Object} opt_attribs Any creation attributes you want to pass in.
     * @return {WebGLRenderingContext} The created context.
     */
    var create3DContext = function(canvas, opt_attribs) {
        var names = ["webgl", "experimental-webgl"];
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
}());

// Error messages
var GET_A_WEBGL_BROWSER = '' +
    'This page requires a browser that supports WebGL.<br/>' +
    '<a href="http://get.webgl.org">Click here to upgrade your browser.</a>';

var OTHER_PROBLEM = '' +
    "It doesn't appear your computer can support WebGL.<br/>" +
    '<a href="http://get.webgl.org/troubleshooting/">Click here for more information.</a>';
