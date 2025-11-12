export class ApiError extends Error {
    constructor(message: string) {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'ApiError';
    }
}

export class NetworkError extends ApiError {
    constructor(message: string = "Error de red. Por favor, revise su conexión a internet e inténtelo de nuevo.") {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'NetworkError';
    }
}

export class InvalidQueryError extends ApiError {
    constructor(message: string = "La consulta es inválida o no se pudo procesar. Pruebe con una búsqueda diferente.") {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'InvalidQueryError';
    }
}

export class ServiceUnavailableError extends ApiError {
    constructor(message: string = "El servicio no está disponible en este momento. Por favor, intente más tarde.") {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'ServiceUnavailableError';
    }
}

export class NoApiKeyError extends ApiError {
    constructor(message: string = "La clave de API no está configurada. Contacte al administrador de la aplicación.") {
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        this.name = 'NoApiKeyError';
    }
}
