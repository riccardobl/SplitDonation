export default class Sane{
    static init(dompurify) {
        this.DOMPurify=dompurify;
        return true;
    }
    static float(v){
        const nv=Number.parseFloat(v);
        if(isNaN(nv))throw  new Error(v+" Not a Number");
        return nv;
    }

    static int(v){
        const nv=Number.parseInt(v);
        if(isNaN(nv))throw new Error(v+" is Not a Number");
        return nv;
    }
    static str(text, options) {
        if(!text)return text;
        if(typeof text!="string")text=""+text;
        if(typeof options!="object") throw new Error("Invalid options");
        if(! this.DOMPurify)throw  new Error("DOMPurify unset");

        const html = options.html;
        if (typeof html != "undefined") {
            if (!html) {
                text = this.DOMPurify.sanitize(text, { USE_PROFILES: { html: false } });
            } else {
                text = this.DOMPurify.sanitize(text, { 
                    ALLOWED_TAGS: [
                        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 
                        'br', 'b', 'i', 'strong', 'em', 'a', 'pre', 'code', 'img', 'div', 'ins', 
                        'del', 'sup', 'sub', 'p', 'ol', 'ul', 'table', 'thead', 'tbody', 
                        'tfoot', 'blockquote', 'dl', 'dt', 'dd',  'q', 'samp', 'var', 'hr', ,  'li', 'tr',
                        'td', 'th', 's', 'strike', 'summary', 'details'
                    ],
                    ALLOWED_ATTR: ["class","tabindex",'href','src','alt','type','height','width','controls','lang']
                } );
            }
        }
        let filter = options.f||options.filter;
        if (filter) {
           if(typeof filter=="string"){
               filter=new RegExp("^" + filter + "$");
           } 
            if (!filter.test(text)) {
                console.trace();
                throw  new Error("Invalid string. "+text+" Filtered by " + filter);
            }
        }
        return text.trim();
    }

}