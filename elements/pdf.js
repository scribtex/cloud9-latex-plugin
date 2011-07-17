define(function(require, exports, module) {

apf.pdf = function(struct, tagName){
    this.$init(tagName || "pdf", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$supportedProperties.push("source");
    /**** Init ****/

    this.$propHandlers["source"] = function(source) {
        if (!this.oPdf) return;
        this.oPdf.src = source;
    };
    
    this.$draw = function(){
        //Build Main Skin
        this.$ext = this.$getExternal();
        this.oPdf = this.$getLayoutNode("main", "pdf", this.$ext);
    };
}).call(apf.pdf.prototype = new apf.Presentation());

apf.aml.setElement("pdf", apf.pdf);

return apf.pdf

});
