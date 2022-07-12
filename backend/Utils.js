//@ts-check
import Fs from 'fs/promises';
import {constants as FsConstants} from 'fs';

export default class Utils {
    static async findLightningAddress(text){
        const v=/\u26A1([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/ig.exec(text);
        return v?v[1]:undefined;
    }


    /**
     * Sleep
     * @public
     * @param {number} ms milliseconds to sleep
     * @returns {Promise<void>}
     */
    static async sleep(ms) {
        if (!ms || ms < 0 || isNaN(ms)) return;
        await new Promise((res, rej) => setTimeout(res, ms));
    }

    /**
     * Check if file exists
     * @public
     * @param {string} f String path
     * @returns { Promise<boolean> }
     */
    static async fileExists(f){
        try {
            await Fs.access(f, FsConstants.F_OK)
            return true;
        } catch (e) {
            return false;
        }

    }

     /**
     * Check if it is a successful http response code
     * @public
     * @param {number} code
     * @returns { boolean }
     */
    static isSuccessHttpCode(code){
        const codeString=code.toString();
        return codeString.startsWith("2") || codeString.startsWith("3");
    }
    
}