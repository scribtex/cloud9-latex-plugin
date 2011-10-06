define(function(require, exports, module) {

apf.logentry = function(struct, tagName){
    this.$init(tagName || "logentry", apf.NODE_VISIBLE, struct);
};

(function(){
    this.$supportedProperties.push("summary", "content", "lineno", "path", "type", "ongoto");

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

    this.$propHandlers["path"] = function(path) {
        if (!this.$path) return
        this.$path.innerHTML = path;
        apf.setStyleClass(this.$container, "hasLocation");
    };
    
    this.$propHandlers["lineno"] = function(lineno) {
        if (!this.$lineno) return
        this.$lineno.innerHTML = lineno + "";
        apf.setStyleClass(this.$container, "hasLocation");
    };

    this.$propHandlers["ongoto"] = function(callback) {
        this.$gotoButton = new apf.button({
            caption : "Goto",
            skin    : "gotobutton",
            skinset : "latex"
        });
        apf.document.body.appendChild(this.$gotoButton);
        this.$goto.appendChild(this.$gotoButton.$ext);

        this.$gotoButton.addEventListener("click", callback);
    };

    this.$draw = function(){
        this.$ext       = this.$getExternal();
        this.$container = this.$getLayoutNode("main", "container", this.$ext);
        this.$toggle    = this.$getLayoutNode("main", "toggle", this.$ext);
        this.$summary   = this.$getLayoutNode("main", "summary", this.$ext);
        this.$goto      = this.$getLayoutNode("main", "goto", this.$ext);
        this.$content   = this.$getLayoutNode("main", "content", this.$ext);
        this.$path      = this.$getLayoutNode("main", "path", this.$ext);
        this.$lineno    = this.$getLayoutNode("main", "lineno", this.$ext);
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
