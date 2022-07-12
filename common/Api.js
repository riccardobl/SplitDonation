

import Sane from "./Sane.js";
export default class Api {
    static globalCache={};

    constructor(defKey, defLoader) {
        this.defLoader=defLoader;
        this.defKey = defKey;


    }
    // checkString(text, options) {
    //     const filter = options.filter;
    //     if (filter) {
    //         if (!new RegExp("^" + filter + "$").test(text)) {
    //             console.trace();
    //             throw "Invalid string. "+text+" Filtered by " + filter;
    //         }
    //     }
    //     return true;
    // }
    // sanitize(text, mode) {
    //     const html = mode.html;
    //     if (typeof html != "undefined") {
    //         if (!html) {
    //             text = this.DOMPurify.sanitize(text, { USE_PROFILES: { html: false } });
    //         } else {
    //             text = this.DOMPurify.sanitize(text, { 
    //                 ALLOWED_TAGS: [
    //                     'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 
    //                     'br', 'b', 'i', 'strong', 'em', 'a', 'pre', 'code', 'img', 'div', 'ins', 
    //                     'del', 'sup', 'sub', 'p', 'ol', 'ul', 'table', 'thead', 'tbody', 
    //                     'tfoot', 'blockquote', 'dl', 'dt', 'dd',  'q', 'samp', 'var', 'hr', ,  'li', 'tr',
    //                     'td', 'th', 's', 'strike', 'summary', 'details'
    //                 ],
    //                 ALLOWED_ATTR: ["class","tabindex",'href','src','alt','type','height','width','controls','lang']
    //             } );
    //         }
    //     }
    //     return text.trim();
    // }

    async getDefByType(type,key) {
        if(!key)key=this.defKey;
        if(!key)throw "Invalid key";
        let def=Api.globalCache[key];
        if(!def){
            def=await this.defLoader(key);
            if(!def)throw "Can't load def",type,key;
            Api.globalCache[key]=def;
        }

        for (let k in def) {
            if (def[k]["type"].indexOf(type) != -1) return JSON.parse(JSON.stringify(def[k]));
        }
        return null;
    }

    async parseAndTypecheck(reqType,k, value, entryDef,withMeta) {
        if (!entryDef) return;
        const entryType = entryDef["type"];
        if(!entryType)return undefined;

        if(value==null)value=undefined;
        if(typeof value==="undefined")return undefined;

        if (entryType === "string" && typeof value == "string") {
            if(value.trim()=="")return undefined;
            if (
                (typeof entryDef["minLength"] == "undefined" || value.length > entryDef["minLength"])
                &&
                (typeof entryDef["maxLength"] == "undefined" || value.length < entryDef["maxLength"])
            ) {
                if(typeof entryDef["sanitize"]!="undefined"){
                    value=Sane.str(value,entryDef["sanitize"])
                }
                return value;
            } else {
                throw "Invalid length " + k;
            }
        } else if (entryType === "options" && typeof value == "string") {
            if (
                (typeof entryDef["minLength"] == "undefined" || value.length > entryDef["minLength"])
                &&
                (typeof entryDef["maxLength"] == "undefined" || value.length < entryDef["maxLength"])
            ) {
                for (let ok in entryDef["options"]) {
                    if (ok == value) {
                        return entryDef["options"][ok]["id"];
                    }
                }
                throw "Invalid option " + k;
            }
            throw "Invalid length " + k;
        } else if (entryType === "number" && typeof value == "number") {
            if (
                (typeof entryDef["min"] == "undefined" || value >= entryDef["min"])
                &&
                (typeof entryDef["max"] == "undefined" || value <= entryDef["max"])
            ) {
                if(entryDef["number-type"]){
                    if(entryDef["number-type"]=="float"){
                        value=Sane.float(value);                    
                    }else if(entryDef["number-type"]=="int"){
                        value=Sane.int(value);                    
                    }else {
                        throw "Invalid number type "+entryDef["number-type"];
                    }
                }
                return value;
            }
            throw "Out of range: " + k+" "+ value;
        } else if (entryType === "boolean" && typeof value == "boolean") {
            return Boolean(value);
        } else if (entryType.endsWith("-array") && Array.isArray(value)) {
            if (typeof entryDef["minArrayLength"] != "undefined" && value.length < entryDef["minArrayLength"]) throw "Array is too short " + entryType;
            if (typeof entryDef["maxArrayLength"] != "undefined" && value.length > entryDef["maxArrayLength"]) throw "Array is too long " + entryType;

            let subType=entryType.substring(0, entryType.indexOf("-array"));
            let subDef;
            if(subType=="custom"){
                if(!entryDef["template"]) throw new Error( `Missing required template for : ${k} in ${this.defKey}` );
                subDef=await this.getDefByType(reqType,entryDef["template"]);
            }else{
                subDef = JSON.parse(JSON.stringify(entryDef)); 
                subDef["type"] = subType;
            }



            for (let i in value) {          
                value[i] =  await this.parseWithDef(reqType, subDef, value[i], withMeta);
            }
            return value;

        }else if (entryType === "object") {
            if(!entryDef["template"]) throw new Error( `Missing required template for : ${k} in ${this.defKey}` );
            const subDef=await this.getDefByType(reqType,entryDef["template"]);         
            value = await this.parseWithDef(reqType, subDef, value, withMeta);
            return value;
        }
        throw new Error(
            "Unknown type Expected: " + entryType + " but provided value is of type: " 
            + typeof value + " for key " + k
        );
    }

    async parseWithDef(type,def, values, withMeta) {
        const getValue=(value,def)=>{
            if (typeof value == "object" && value&&value["value"]) value = value["value"];
            if (typeof value=="undefined") value = def.value; // use default value if unset
            return value;
        };
        if (!values){
            throw "undefined values?";
        } 
        const out = {};

        // Shortcut for errors.
        if(values["error"]&&def["error"]){
            let error=values["error"];
            error=getValue(error,def["error"]);
            out["error"]=await this.parseAndTypecheck(type,"error", error, def["error"],withMeta);
            return out;
        }
        
        for (let k in def) {
            if(k=="?")continue; // skip documentation 
            let value = values[k];

            value=getValue(value,def[k]);
            
            if ( typeof value == "undefined") {
                if(def[k]["required"] )throw new Error("Missing required field " + k+" ");
                 else continue;
            }


            value = await this.parseAndTypecheck(type,k, value, def[k],withMeta);
            
            if (def[k]["required"] && typeof value == "undefined") throw new Error("Missing required field " + k);

            if(! (typeof value=="undefined")){
                if (withMeta) {
                    def[k]["value"] = value;
                    out[k] = def[k];
                } else {
                    out[k] = value;
                }
            }
        }

        return out;
    }


    async parse(type, values, withMeta) {
   

        let def = await this.getDefByType(type);
        if (!def) throw "No def found for type " + type;
        return await this.parseWithDef(type,def,values,withMeta);
    }
}

