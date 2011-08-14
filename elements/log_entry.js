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
            this.$hasContent();
            this.$hideContent();
            this.$content.innerHTML = content;
        }
    };
    
    this.$propHandlers["type"] = function(type) {
        if (!this.$container) return;
        apf.setStyleClass(this.$container, type);
    };
    
    this.$draw = function(){
        this.$ext       = this.$getExternal();
        this.$container = this.$getLayoutNode("main", "container", this.$ext);
        this.$toggle    = this.$getLayoutNode("main", "toggle", this.$ext);
        this.$summary   = this.$getLayoutNode("main", "summary", this.$ext);
        this.$content   = this.$getLayoutNode("main", "content", this.$ext);
    };

    this.$hasContent = function() {
        apf.setStyleClass(this.$container, "hasContent");

        var self = this;
        this.$container.addEventListener("dblclick", function() {
            self.$toggleContent();
        });
        this.$toggle.addEventListener("click", function() {
            self.$toggleContent();
        });
    };

    this.$toggleContent = function() {
        if (this.$container.className.match("hideContent")) {
            this.$showContent();
        } else {
            this.$hideContent();
        }
    }

    this.$hideContent = function() {
        apf.setStyleClass(this.$container, "hideContent", ["showContent"]);
    }

    this.$showContent = function() {
        apf.setStyleClass(this.$container, "showContent", ["hideContent"]);
    }
}).call(apf.logentry.prototype = new apf.Presentation());

apf.aml.setElement("logentry", apf.logentry);

return apf.logentry

});
