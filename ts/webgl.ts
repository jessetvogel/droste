type AttribLocations = { [key: string]: number };
type UniformLocations = { [key: string]: WebGLUniformLocation };

class Texture {

    gl: WebGLRenderingContext;
    texture: WebGLTexture;
    width: number;
    height: number;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        // Create and bind texture
        this.texture = gl.createTexture();
        this.bind();
        // Set options
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    destroy(): void {
        this.gl.deleteTexture(this.texture);
    }

    bind(slot: number = null): void {
        if (slot !== null)
            this.gl.activeTexture(this.gl.TEXTURE0 + slot);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    }

    setImageData(image: HTMLImageElement): void {
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

    setData(width: number, height: number, data: ArrayBufferView): void {
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

    gl: WebGLRenderingContext;
    framebuffer: WebGLFramebuffer;
    texture: Texture;

    constructor(gl: WebGLRenderingContext, width: number, height: number) {
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

    destroy(): void {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.texture.destroy();
    }

    bind(): void {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.framebuffer);
    }
}

class Shader {

    gl: WebGLRenderingContext;
    program: WebGLProgram;
    attribLocations: AttribLocations;
    uniformLocations: UniformLocations;

    constructor(gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string) {
        this.gl = gl;
        this.program = this.createProgram(vertexSource, fragmentSource);
        this.uniformLocations = this.getUniformLocations();
        this.attribLocations = this.getAttribLocations();
    }

    use(): void {
        this.gl.useProgram(this.program);
    }

    destroy(): void {
        this.gl.deleteProgram(this.program);
    }

    getUniformLocations(): UniformLocations {
        const uniformLocations: UniformLocations = {};
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

    getAttribLocations(): AttribLocations {
        const attribLocations: AttribLocations = {};
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

    createProgram(vertexSource: string, fragmentSource: string): WebGLProgram {
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

    createShader(type: number, source: string): WebGLShader {
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

    gl: WebGLRenderingContext;
    buffer: WebGLBuffer;

    constructor(gl: WebGLRenderingContext) {
        this.gl = gl;
        this.buffer = gl.createBuffer();
    }

    destroy(): void {
        this.gl.deleteBuffer(this.buffer);
    }

    setData(data: number[]): void {
        // Bind buffer and set data
        this.bind();
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(data), this.gl.STATIC_DRAW);
    }

    bind(): void {
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    }

}
