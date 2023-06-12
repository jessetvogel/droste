let canvas = null;
let gl = null;
let vertexBuffer = null;
let shader = null;
let texture = null;
let time = 0;
let options = {
    boundary: false,
    animationSpeed: 0.0,
    latticePoint: [1.0, 1.0],
    scale: 4.0,
    translation: [0.0, 0.0],
    rotation: 0.0
};
const FPS = 60.0;
async function setupWebGL(_canvas, width, height) {
    // Set canvas size
    canvas = _canvas;
    canvas.width = width;
    canvas.height = height;
    // Create GL context
    gl = canvas.getContext('webgl2');
    if (gl === null) {
        alert('Unable to initialize WebGL. Your browser or machine may not support it.');
        return;
    }
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // Create texture
    texture = new Texture(gl);
    texture.setImageData($('image'));
    // Create vertex buffer
    vertexBuffer = new Buffer(gl);
    vertexBuffer.setData([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);
    // Create shader program
    const vsSource = await fetch('shader/shader.vert').then(response => response.text());
    const fsSource = await fetch('shader/shader.frag').then(response => response.text());
    shader = new Shader(gl, vsSource, fsSource);
}
async function init() {
    // Initialize WebGL context
    const canvas = $('canvas');
    await setupWebGL(canvas, canvas.clientWidth * window.devicePixelRatio, canvas.clientHeight * window.devicePixelRatio);
    // Set starting time
    time = 0.0;
    // Keep rendering
    setInterval(() => { if (options.animationSpeed != 0.0)
        render(); }, 1000.0 / FPS);
    render();
    // Controls
    $('checkbox-boundary').checked = options.boundary;
    onInput($('checkbox-boundary'), function () { options.boundary = !options.boundary; render(); });
    $('range-animation-speed').value = '' + options.animationSpeed;
    onInput($('range-animation-speed'), function () { options.animationSpeed = parseFloat(this.value); render(); });
    $('input-lattice-x').value = '' + options.latticePoint[0];
    $('input-lattice-y').value = '' + options.latticePoint[1];
    onInput($('input-lattice-x'), function () { options.latticePoint[0] = parseFloat(this.value); render(); });
    onInput($('input-lattice-y'), function () { options.latticePoint[1] = parseFloat(this.value); render(); });
    $('input-translation-x').value = '' + options.translation[0];
    $('input-translation-y').value = '' + options.translation[1];
    onInput($('input-translation-x'), function () { options.translation[0] = parseFloat(this.value); render(); });
    onInput($('input-translation-y'), function () { options.translation[1] = parseFloat(this.value); render(); });
    $('input-scale').value = '' + options.scale;
    onInput($('input-scale'), function () { options.scale = parseFloat(this.value); render(); });
    $('input-rotation').value = '' + options.rotation;
    onInput($('input-rotation'), function () { options.rotation = parseFloat(this.value); render(); });
    onChange($('input-file'), function (event) {
        const file = this.files[0];
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            // Convert image file to base64 string
            const image = $('image');
            image.onload = function () { texture.setImageData(image); render(); };
            image.src = reader.result;
        }, false);
        if (file)
            reader.readAsDataURL(file);
    });
    onClick($('button-gif'), exportGIF);
}
function render() {
    // Clear canvas
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    // Bind buffer
    {
        const numComponents = 2;
        const type = gl.FLOAT;
        const normalize = false;
        const stride = 0;
        const offset = 0;
        vertexBuffer.bind();
        gl.vertexAttribPointer(shader.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset);
        gl.enableVertexAttribArray(shader.attribLocations.vertexPosition);
    }
    // Use program
    shader.use();
    // Set uniforms
    {
        // Texture
        texture.bind(0);
        gl.uniform1i(shader.uniformLocations['uTexture'], 0);
        // Transformations
        const translation = { x: options.translation[0], y: options.translation[1] };
        const scale = 1.0 / options.scale;
        const rotation = options.rotation / 180.0 * Math.PI;
        const scaleRotation = new Float32Array([
            scale * Math.cos(rotation), scale * Math.sin(rotation),
            -scale * Math.sin(rotation), scale * Math.cos(rotation)
        ]);
        let origin = { x: 0, y: 0 };
        for (let i = 0; i < 20; ++i) {
            origin = {
                x: scaleRotation[0] * origin.x + scaleRotation[1] * origin.y + translation.x,
                y: scaleRotation[2] * origin.x + scaleRotation[3] * origin.y + translation.y
            };
        }
        gl.uniform1f(shader.uniformLocations['uScale'], scale);
        gl.uniform1f(shader.uniformLocations['uRotation'], rotation);
        gl.uniform2f(shader.uniformLocations['uTranslation'], translation.x, translation.y);
        gl.uniform2f(shader.uniformLocations['uOrigin'], origin.x, origin.y);
        gl.uniform1f(shader.uniformLocations['uTime'], time);
        gl.uniform2f(shader.uniformLocations['uSize'], texture.width, texture.height);
        gl.uniform1i(shader.uniformLocations['uBoundary'], options.boundary ? 1 : 0);
        gl.uniform2f(shader.uniformLocations['uLatticePoint'], options.latticePoint[0], options.latticePoint[1]);
    }
    // Update time
    time += 1.0 / FPS * options.animationSpeed;
    // Draw arrays
    {
        const offset = 0;
        const vertexCount = 4;
        gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
    }
}
window.onload = init;
async function exportGIF() {
    const button = $('button-gif');
    button.disabled = true;
    const newCanvas = create('canvas', { 'width': 512, 'height': 512 });
    await setupWebGL(newCanvas, 512, 512);
    const capturer = new CCapture({
        format: 'gif',
        workersPath: 'js/',
        framerate: FPS
    });
    capturer.start();
    for (let t = 0; t < 1.0; t += 1.0 / FPS) {
        time = t;
        render();
        capturer.capture(newCanvas);
    }
    capturer.stop();
    capturer.save();
    const canvas = $('canvas');
    await setupWebGL(canvas, canvas.clientWidth * window.devicePixelRatio, canvas.clientHeight * window.devicePixelRatio);
    button.disabled = false;
}
function $(id) {
    return document.getElementById(id);
}
function $$(selector) {
    return Array.from(document.querySelectorAll(selector));
}
function create(tag, properties, content) {
    const elem = document.createElement(tag);
    if (properties !== undefined) {
        for (const key in properties) {
            if (key.startsWith('@'))
                elem.addEventListener(key.substring(1), properties[key]);
            else
                elem.setAttribute(key, properties[key]);
        }
    }
    if (content !== undefined) {
        if (typeof (content) === 'string')
            elem.innerHTML = content;
        if (content instanceof HTMLElement)
            elem.append(content);
        if (Array.isArray(content))
            for (const child of content)
                elem.append(child);
    }
    return elem;
}
function clear(elem) {
    elem.innerHTML = '';
}
function onClick(elem, f) {
    elem.addEventListener('click', f);
}
function onContextMenu(elem, f) {
    elem.addEventListener('contextmenu', f);
}
function onChange(elem, f) {
    elem.addEventListener('change', f);
}
function onInput(elem, f) {
    elem.addEventListener('input', f);
}
function onWheel(elem, f) {
    elem.addEventListener('wheel', f);
}
function onRightClick(elem, f) {
    elem.addEventListener('contextmenu', f);
}
function onKeyPress(elem, f) {
    elem.addEventListener('keypress', f);
}
function onKeyDown(elem, f) {
    elem.addEventListener('keydown', f);
}
function onKeyUp(elem, f) {
    elem.addEventListener('keyup', f);
}
function addClass(elem, c) {
    elem.classList.add(c);
}
function removeClass(elem, c) {
    elem.classList.remove(c);
}
function hasClass(elem, c) {
    return elem.classList.contains(c);
}
function setHTML(elem, html) {
    elem.innerHTML = html;
}
function setText(elem, text) {
    elem.innerText = text;
}
function requestGET(url) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(this.responseText); };
        xhr.onerror = reject;
        xhr.open('GET', url);
        xhr.send();
    });
}
function requestPOST(url, data) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.onload = function () { resolve(this.responseText); };
        xhr.onerror = reject;
        xhr.open('POST', url);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(data);
    });
}
class Texture {
    constructor(gl) {
        this.gl = gl;
        // Create and bind texture
        this.texture = gl.createTexture();
        this.bind();
        // Set options
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    destroy() {
        this.gl.deleteTexture(this.texture);
    }
    bind(slot = null) {
        if (slot !== null)
            this.gl.activeTexture(this.gl.TEXTURE0 + slot);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    }
    setImageData(image) {
        // Bind texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        // Set image data
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const srcFormat = this.gl.RGBA;
        const srcType = this.gl.UNSIGNED_BYTE;
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, srcFormat, srcType, image);
        // Set width and height
        this.width = image.naturalWidth;
        this.height = image.naturalHeight;
    }
    setData(width, height, data) {
        // Bind texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        // Set data
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const srcFormat = this.gl.RGBA;
        const srcType = this.gl.UNSIGNED_BYTE;
        const border = 0;
        this.gl.texImage2D(this.gl.TEXTURE_2D, level, internalFormat, width, height, border, srcFormat, srcType, data);
        // Set width and height
        this.width = width;
        this.height = height;
    }
}
class Framebuffer {
    constructor(gl, width, height) {
        this.gl = gl;
        // Create and bind framebuffer
        this.framebuffer = gl.createFramebuffer();
        this.bind();
        // Create texture
        this.texture = new Texture(this.gl);
        this.texture.setData(width, height, null);
        // Attach texture as first color attachment
        const attachmentPoint = gl.COLOR_ATTACHMENT0;
        const level = 0;
        gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.texture.texture, level);
    }
    destroy() {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.texture.destroy();
    }
    bind() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    }
}
class Shader {
    constructor(gl, vertexSource, fragmentSource) {
        this.gl = gl;
        this.program = this.createProgram(vertexSource, fragmentSource);
        this.uniformLocations = this.getUniformLocations();
        this.attribLocations = this.getAttribLocations();
    }
    use() {
        this.gl.useProgram(this.program);
    }
    destroy() {
        this.gl.deleteProgram(this.program);
    }
    getUniformLocations() {
        const uniformLocations = {};
        const numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
        const indices = [...Array(numUniforms).keys()];
        for (let i = 0; i < numUniforms; ++i) {
            const uniformInfo = this.gl.getActiveUniform(this.program, i);
            const name = uniformInfo.name;
            // Skip built-in uniforms
            if (name.startsWith('gl_') || name.startsWith('webgl_'))
                continue;
            // Get location (TODO: is this needed?)
            const location = this.gl.getUniformLocation(this.program, name);
            uniformLocations[name] = location;
        }
        return uniformLocations;
    }
    getAttribLocations() {
        const attribLocations = {};
        const numAttribs = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
        for (let i = 0; i < numAttribs; ++i) {
            const attribInfo = this.gl.getActiveAttrib(this.program, i);
            const name = attribInfo.name;
            // Skip built-in uniforms
            if (name.startsWith('gl_') || name.startsWith('webgl_'))
                continue;
            // Get location (TODO: is this needed?)
            const location = this.gl.getAttribLocation(this.program, name);
            attribLocations[name] = location;
        }
        return attribLocations;
    }
    createProgram(vertexSource, fragmentSource) {
        // Create shaders
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);
        // Create shader program
        const shaderProgram = this.gl.createProgram();
        this.gl.attachShader(shaderProgram, vertexShader);
        this.gl.attachShader(shaderProgram, fragmentShader);
        this.gl.linkProgram(shaderProgram);
        this.gl.detachShader(shaderProgram, vertexShader);
        this.gl.detachShader(shaderProgram, fragmentShader);
        this.gl.deleteShader(vertexShader);
        this.gl.deleteShader(fragmentShader);
        // Check for errors
        if (!this.gl.getProgramParameter(shaderProgram, this.gl.LINK_STATUS))
            throw this.gl.getProgramInfoLog(shaderProgram);
        return shaderProgram;
    }
    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        // Check for errors
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const message = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw message;
        }
        return shader;
    }
}
class Buffer {
    constructor(gl) {
        this.gl = gl;
        this.buffer = gl.createBuffer();
    }
    destroy() {
        this.gl.deleteBuffer(this.buffer);
    }
    setData(data) {
        // Bind buffer and set data
        this.bind();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
    }
    bind() {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }
}
//# sourceMappingURL=script.js.map