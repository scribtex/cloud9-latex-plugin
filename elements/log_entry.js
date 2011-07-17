define(function(require, exports, module) {

apf.logentry = function(struct, tagName){
    this.$init(tagName || "logentry", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$supportedProperties.push("summary", "content", "lineno", "path", "type");

    this.$propHandlers["summary"] = function(summary) {
        if (!this.$summary) return;
        this.$summary.innerHTML = summary;
    };

    this.$propHandlers["content"] = function(content) {
        if (!this.$content) return;
        if (content) {
            this.$content.innerHTML = content;
            this.$content.style.display = "block";
        }
    };
    
    this.$propHandlers["type"] = function(type) {
        if (!this.$container) return;
        var curClass = this.$container.getAttribute("class") || "";
        this.$container.setAttribute("class", curClass + " " + type);
    };
    
    this.$draw = function(){
        this.$ext = this.$getExternal();
        this.$arrow = this.$getLayoutNode("main", "icon", this.$ext);
        this.$summary = this.$getLayoutNode("main", "summary", this.$ext);
        this.$content = this.$getLayoutNode("main", "content", this.$ext);
        this.$container = this.$getLayoutNode("main", "container", this.$ext);
        
        this.$content.style.display = "none";
    };
}).call(apf.logentry.prototype = new apf.Presentation());

apf.aml.setElement("logentry", apf.logentry);

return apf.logentry

});
