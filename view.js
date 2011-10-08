define(function(require, exports, modules) {

    var View = function() {};

    (function() {
        this.init = function() {
            this.initViewMenu();
        };

        this.initViewMenu = function() {
            mnuView.appendChild(new apf.item({
                caption : "Pdf View",
                submenu : "mnuPdfView"
            }));
            apf.document.body.appendChild(new apf.menu({
                id : "mnuPdfView"
            }));

            var self = this;
            mnuPdfView.appendChild(this.itmSideBySide = new apf.item({
                caption : "Side by side",
                type    : "radio",
                onclick : function() {
                    self.$showPdfSideBySide();
                }
            }));
            mnuPdfView.appendChild(this.itmSinglePane = new apf.item({
                caption : "Tabbed",
                type    : "radio",
                onclick : function() {
                    self.$showPdfTabbed();
                }
            }));
        };

        this.$showPdfSideBySide = function() {};
        this.$showPdfTabbed = function() {};
    }).call(View.prototype);

    return View;
})
