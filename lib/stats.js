"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const logger_1 = __importStar(require("./logger"));
function digestIP(ip) {
    return crypto_1.webcrypto.subtle
        .digest('SHA-1', new TextEncoder().encode(ip))
        .then((d) => {
        return Array.from(new Uint8Array(d))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    });
}
class Stats {
    constructor(config) {
        this.logger = (0, logger_1.default)(config, 'Main', 'Stats');
        // Expected to be updated by website workers
        this.visitors = new Set();
        this.visitorsCount = 0;
        this.queryCount = 0;
        // Expected to be updated by main worker
        this.updatedDB = 0;
        this.dbVersion = 0;
        this.lastUpdate = '';
        this.lastDBUpdate = '';
    }
    serialize() {
        return {
            queryCount: this.queryCount,
            visitorsCount: this.visitorsCount,
            errorCount: logger_1.errorCount,
            updatedDB: this.updatedDB,
            dbVersion: this.dbVersion,
            lastUpdate: this.lastUpdate,
            lastDBUpdate: this.lastDBUpdate,
        };
    }
    addVisitor(ip) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const hash = yield digestIP(ip);
                if (!this.visitors.has(hash)) {
                    this.visitorsCount++;
                    this.visitors.add(hash);
                }
                this.queryCount++;
            }
            catch (err) {
                this.logger.error('Error while adding visitor');
                console.log(err);
            }
        });
    }
    clearVisitors() {
        this.visitors = new Set();
        this.visitorsCount = 0;
        this.queryCount = 0;
    }
}
exports.default = Stats;
