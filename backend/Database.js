//@ts-check
import atomicWrite from 'write-file-atomic';
import Path from 'path';
import Fs from 'fs/promises';
import Crypto from 'crypto';
import Utils from './Utils.js';

/**
 * @callback Supplier
 * @param {string} key
 * @return {Promise<Object>} output
 */

export default class Database{
   
    
    /**
     * @param {string} root 
     */
    constructor(root){
         /**
         * @type {string}
         * @private
         */
        this.root=root;
        
   
        // this.pendingUpdates={};
    }

    /**
     * Create hash of passed string
     * @private
     * @param {string} a 
     * @returns {string}
     */
    hash(a){
        return Crypto.createHash('sha256').update(a).digest('hex');
    }

    async getRoot(){
        if(!await Utils.fileExists(this.root))await Fs.mkdir(this.root,{recursive:true});
        return this.root;
    }

    /**
     * Get an entry from the database
     * @public
     * @param {string} key the key of the entry
     * @param {number} [expirationMs] time in ms after which the entry is considered expired
     * @returns {Promise<Object>}
     */
    async get(key,expirationMs){
        const f=Path.join(await this.getRoot(),this.hash(key))+".json";
        if(await Utils.fileExists(f)){          
            const fileData=(await Fs.readFile(f)).toString();       
            try{
                const data = JSON.parse(fileData);
                if(!data) throw "Invalid data.";
                if(!expirationMs||(Date.now()-data.timestamp)<expirationMs){ // check if expired
                    return data.data;
                }
            }catch(e){
                console.error("Corrupted file",f,e);
            }
        }
        return undefined;
    }

    /**
     * Set an entry in the database
     * @public
     * @param {string} key Key of the entry (will be hashed)
     * @param {Object} data Data of the entry
     * @returns {Promise<void>}
     */
    async set(key,data) {
        const f=Path.join(await this.getRoot(),this.hash(key))+".json";
        await atomicWrite(f,JSON.stringify({
            timestamp:Date.now(),
            data:data
        }));
    }

    /**
     * Get an entry from the database or set with the provider function if it doesn't exist
     * @public
     * @param {string} key Key of the entry (will be hashed)
     * @param {Supplier} supplier function to supply the data if the entry doesn't exist
     * @param {number} [expirationMs] time in ms after which the entry is considered expired
     * @returns {Promise<Object>}
     */
    async getOrSet(key, supplier, expirationMs) {
        let data=await this.get(key,expirationMs);
        if(typeof data==="undefined"){
            data=await supplier(key);
            if(typeof data==="undefined")data=null;
            await this.set(key,data);
        }        
        return data;
    }


}