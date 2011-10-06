/**
 * Node Runner Module for the Cloud9 IDE
 *
 * @copyright 2010, Ajax.org B.V.
 * @license GPLv3 <http://www.gnu.org/licenses/gpl.txt>
 */

define(function(require, exports, module) {

var ide = require("core/ide");
var ext = require("core/ext");
var util = require("core/util");
var settings = require("ext/settings/settings");
var markup = require("text!ext/latex/compile.xml");
var skin = require("text!ext/latex/skin.xml");
var settingsMarkup = require("text!ext/latex/settings.xml");
var filesystem = require("ext/filesystem/filesystem");
var logParser = require("ext/latex/log_parser");
var pdf = require("ext/latex/elements/pdf");
var logEntry = require("ext/latex/elements/log_entry");

return ext.register("ext/latex/compile", {
    name    : "LaTeX Compilation",
    dev     : "ScribTeX.com",
    type    : ext.GENERAL,
    alone   : true,
    offline : false,
    skin    : skin,
    markup  : markup,
    deps    : [],
    commands : {
        "compile"  : {hint: "process the current document through LaTeX and show the output"}
    },
    hotitems: {},

    nodes : [],
    
    clsi : {
        proxiedUrl   : "/clsi",
        unproxiedUrl : "http://localhost:3000"
    },
    
    hook : function() {
        var self = this;
        ide.addEventListener("extload", function() {
            ext.initExtension(self);
        });
    },

    init : function() {        
        ide.addEventListener("loadsettings", function(e) {
            settings.addSection("compiler", "LaTeX", "latex");
        });
        
        ide.addEventListener("init.ext/settings/settings", function(e) {
            barSettings.insertMarkup(settingsMarkup);
        });
        
        while(tbLatexCompile.childNodes.length) {
            var button = tbLatexCompile.firstChild;
            ide.barTools.appendChild(button);
            
            if (button.nodeType == 1)
                this.nodes.push(button);
        }
        
        this.hotitems["compile"] = [btnCompile];
        
        this.setState("idle");
       
        this.sideBySide = true;
        this.addTabs();
        
        mnuCtxTree.insertBefore(new apf.item({
            caption : "Set as main file",
            match   : "[file]",
            onclick : function() {
                var path = apf.activeElement.selected.getAttribute("path");
                path = path.slice(ide.davPrefix.length + 1, path.length);
                settings.model.queryNode("latex/compiler").setAttribute("main_path", path);
            }
        }), mnuCtxTree.childNodes[1]);
        
        var updateModifiedDate = function(e) {
            var node = e.node;
            var date = new Date();
            node.setAttribute("modifieddate", 
                date.toString("ddd, dd MMM yyyy HH:mm:ss") + " " + date.getUTCOffset()
            );
        }
        
        ide.addEventListener("afterfilesave", updateModifiedDate);
    },
    
    addTabs : function() {
        var self = this;

        this.tabBar = new apf.bar({
            skinset  : "latex",
            skin     : "basic",
            style    : "padding : 0 0 33px 0;position:absolute;", //53px
            htmlNode : document.body,
            childNodes: [
                new apf.tab({
                    id       : "tabOutput",
                    skin     : "pdf_tab",
                    style    : "height : 100%;",
                    buttons  : ""
                })
            ]
        });

        this.logContent = logContent;
        logContent.removeNode();
    
        // This is a patch to fix my lack of understanding as to why the content 
        // of the tabs is not always correctly resized to the size of the page
        tabOutput.addEventListener("afterswitch", function(e) {
            window.onresize();
        });

        tabOutput.addEventListener("afterswitch", function(e) {
            if (e.nextPage.name == "pdfPage") {
                self.afterSwitchToPdfTab();
            }
            if (e.previousPage && e.previousPage.name == "pdfPage") {
                self.afterSwitchFromPdfTab();
            }
        });
       
        if (this.sideBySide) {
            this.$initSideBySideTabs();
        } else {
            this.$initSinglePaneTabs();
        }

    },

    $initSideBySideTabs: function() {
        this.pdfSplitter = splitterPanelPdf;
        this.colPdf = colPdf;
        this.pdfSplitter.show();
        this.colPdf.show();

        this.hbox = this.colPdf.appendChild(new apf.hbox({flex : 1, padding : 5, splitters : true}));
        var tabPlaceholder = this.hbox.appendChild(
            new apf.bar({id:"tabPdfPlaceholder", flex:1, skin:"basic"})
        );

        var self = this;
        tabPlaceholder.addEventListener("resize", this.resizeTabCallback = function(e){
            // Copied from ext/editors/editors.js to put the tabs in the right place
            var ext = self.tabBar.$ext, ph;
            var pos = apf.getAbsolutePosition(ph = tabPlaceholder.$ext);
            ext.style.left = pos[0] + "px";
            ext.style.top  = pos[1] + "px";
            var d = apf.getDiff(ext);
            ext.style.width = (ph.offsetWidth + 2 + (apf.isGecko && colRight.visible ? 2 : 0) - d[0]) + "px";
            ext.style.height = (ph.offsetHeight - d[1]) + "px";
        });

        this.colPdf.addEventListener("resize", function(e) {
            self.showPdf();
        });
    },

    $destroySideBySideTabs: function() {
        this.pdfSplitter.hide();
        this.colPdf.hide();
    
        this.hbox.removeNode();
        delete this.hbox;

        tabPlaceholder.removeEventListener("resize", this.resizeTabCallback);
        delete this.resizeTabCallback;
    },

    $initSinglePaneTabs: function() {
        // Make space on the right hand side of the editor tabs
        var editorTabBar = tabEditors.$ext.selectNodes("div[1]")[0];
        if (editorTabBar)
            editorTabBar.style["margin-right"] = "130px";

        // Even though we have two groups of tabs we want them to behave like
        // one, so when a tab in one is activated we deactivate the tab in the 
        // other.
        tabOutput.addEventListener("beforeswitch", this.tabOutputCallback = function() { 
            self.deactivateEditorTabs();
        });
        tabEditors.addEventListener("beforeswitch", this.tabEditorsCallback = function() {
            self.deactivateOutputTabs();
        });

        var self = this;
        tabPlaceholder.addEventListener("resize", this.resizeTabCallback = function(e){
            // Copied from ext/editors/editors.js to put the tabs in the right place
            var ext = self.tabBar.$ext, ph;
            var pos = apf.getAbsolutePosition(ph = tabPlaceholder.$ext);
            ext.style.left = pos[0] + "px";
            ext.style.top  = pos[1] + "px";
            var d = apf.getDiff(ext);
            ext.style.width = (ph.offsetWidth + 2 + (apf.isGecko && colRight.visible ? 2 : 0) - d[0]) + "px";
            ext.style.height = (ph.offsetHeight - d[1]) + "px";
        });
    },

    $destroySinglePaneTabs: function() {
        // Remove the space on the right hand side of the editor tabs
        var editorTabBar = tabEditors.$ext.selectNodes("div[1]")[0];
        if (editorTabBar)
            editorTabBar.style["margin-right"] = "0";

        tabOutput.removeEventListener("beforeswitch", this.tabOutputCallback);
        tabEditors.removeEventListener("beforeswitch", this.tabEditorsCallback);

        tabPlaceholder.removeEventListener("resize", this.resizeTabCallback);
        delete this.resizeTabCallback;
    },
    
    deactivateEditorTabs : function() {
        if (tabEditors.getPages().length > 0)
            tabEditors.getPage().$deactivate();
    },
    
    deactivateOutputTabs : function() {
        if (tabOutput.getPages().length > 0)
            tabOutput.getPage().$deactivate();
        this.hidePdf();
    },
    
    initOutputTabs: function() {
        if (!tabOutput.getPage("pdfPage")) {
            this.pdfPage = tabOutput.add("PDF", "pdfPage");
        }
        
        if (!tabOutput.getPage("logPage")) {
            this.logPage = tabOutput.add("Log", "logPage");
        }
    },

    jumpToFileAndLineNumber: function(path, lineNo) {
        var name;
        // This is ok if there is no / because then lastIndexOf returns -1
        // so we get the whole string.
        name = path.slice(path.lastIndexOf("/") + 1)

        // Remove any leading /s and prepend the davPrefix.
        var fullPath = path;
        fullPath = fullPath.replace(/^(\/)*/, "");
        fullPath = ide.davPrefix + "/" + fullPath;

        var node = apf.n("<file />")
            .attr("name", name)
            .attr("contenttype", util.getContentType(name))
            .attr("path", fullPath)
            .node();

        ide.addEventListener("afteropenfile", function(e) {
            ceEditor.$editor.gotoLine(lineNo);
            ide.removeEventListener("afteropenfile", arguments.callee);
        })

        ide.dispatchEvent("openfile", { doc: ide.createDocument(node) });
    },
    
    showPdfTab: function() {
        tabOutput.set("pdfPage");
        if (!this.sideBySide) {
            this.deactivateEditorTabs();
        }
        tabOutput.getPage("pdfPage").$activate();
        this.showPdf();
    },
    
    showLogTab: function() {
        tabOutput.set("logPage");
        if (!this.sideBySide) {
            this.deactivateEditorTabs();
        }
        tabOutput.getPage("logPage").$activate();
    },
    
    setPdfTabToPdf: function(url) {
        var page = tabOutput.getPage("pdfPage");
        
        // Get rid of existing content
        this.removePdf();
        while (page.childNodes.length > 0) {
            page.firstChild.removeNode();
        }
        
        this.pdfElement = new apf.pdf({
            skinset : "latex",
            source : url
        });

        apf.document.body.appendChild(this.pdfElement);
        this.hidePdf();
    },
    
    setPdfTabToNoPdf: function() {
        var page = tabOutput.getPage("pdfPage");
        
        // Get rid of existing content
        this.removePdf();
        while (page.childNodes.length > 0) {
            page.firstChild.removeNode();
        }
        
        page.appendChild(noPdf);
    },
    
    setLogTabToLog: function(content) {
        var page = tabOutput.getPage("logPage");
        
        // Get rid of existing content
        while (page.childNodes.length > 0) {
            page.firstChild.removeNode();
        }

        // Force some styling to let us scroll the log
        page.$ext.style["overflow"] = "scroll";

        // Do our best to extract the errors from the log
        var parsedLog = logParser.parse(content);

        // Update the Log tab to show the number of errors
        var totalErrors = parsedLog.errors.length + parsedLog.warnings.length
        if (totalErrors > 0) {
            page.setAttribute("caption", "Log (" + totalErrors + ")")
        } else {
            page.setAttribute("caption", "Log")
        }

        // Append nicely formatted summaries of the errors and warnings
        var self = this;
        function addLogEntry(entry, type) {
            var path;
            if (m = entry.file.match("[0-9a-f]{32}/(.*)$")) {
                path = m[1];
            }

            var logEntry = new apf.logentry({
                summary : self.$apfEscape(entry.message),
                content : self.$apfEscape(entry.content),
                path    : self.$apfEscape(path),
                lineno  : entry.line,
                type    : type
            }) 
            page.appendChild(logEntry);
            if (path && entry.line) {
                logEntry.setProperty("ongoto", function() {
                    self.jumpToFileAndLineNumber(path, entry.line);
                });
            }
        }

        for (i = 0; i < parsedLog.errors.length; i++) {
            var error = parsedLog.errors[i];
            addLogEntry(error, "error");
        }
        
        for (i = 0; i < parsedLog.warnings.length; i++) {
            var warning = parsedLog.warnings[i];
            addLogEntry(warning, "warning");
        }

        // Append the raw log
        var preElement = this.logContent.selectNodes("pre")[0];
        if (preElement)
            preElement.$ext.innerHTML = content;
        page.appendChild(this.logContent);
    },

    hidePdf: function() {
        if (this.pdfElement) {
            var pdfExt = this.pdfElement.$ext

            // Hide it offscreen because setting "display: none" causing the
            // pdf to reset the scroll to the top. This is true in at least 
            // Chrome.
            pdfExt.style.position = "absolute";
            pdfExt.style.top    = "-100px";
            pdfExt.style.height = "5px";
        }
    },

    showPdf: function() {
        if (this.pdfElement) {
            var pageExt = tabOutput.getPage("pdfPage").$ext;
            var pos = apf.getAbsolutePosition(pageExt);
            var pdfExt = this.pdfElement.$ext;
            pdfExt.style["z-index"] = "100"; 
            pdfExt.style.position   = "absolute";
            pdfExt.style.left       = pos[0] + "px";
            pdfExt.style.top        = pos[1] + "px";
            pdfExt.style.width      = pageExt.offsetWidth + "px";
            pdfExt.style.height     = pageExt.offsetHeight + "px";
        }
    },

    removePdf: function() {
        if (this.pdfElement) {
            apf.document.body.removeChild(this.pdfElement);
            delete this.pdfElement;
        }
    },

    afterSwitchToPdfTab: function() {
        this.showPdf();
    },

    afterSwitchFromPdfTab: function() {
        this.hidePdf();
    },

    /* 
     * Called when the user clicks the compile button or issues the compile 
     * command. First a list of files are built, then these are converted into
     * a request to the CLSI.
     */
    compile : function() {
        var self = this;
        this.$readDirectories(function() {
            self.sendCompileToCLSI();
        });
    },
    
    sendCompileToCLSI: function() {
        this.setState("compiling");
        
        request = {
            options : {}
        };
        
        var compiler = settings.model.queryNode("latex/compiler").getAttribute("compiler");
        if (!compiler)
            compiler = "pdflatex";
        request.options.compiler = compiler;

        // Any files which are open in the editor are sent directly with
        // their content.
        var openFiles = {};
        var openPages = tabEditors.getPages();
        for (var i = 0; i < openPages.length; i++) {
            var openPage = openPages[i];
            var path     = openPage.id;
            path = path.slice(ide.davPrefix.length + 1, path.length);
            var content = openPage.$doc.getValue();
            
            openFiles[path] = content;
                
            // Determine the root resource path. If the open and focussed 
            // document is a top level LaTeX file we use this. 
            // If not and there is a top level LaTeX file which is open 
            // but not focused then we use this. 
            // Otherwise we fall back to the manual setting. If this is not
            // present we alert the user and don't go ahead with the compile.
            if (content.match(/\\documentclass/) || content.match(/\\documentstyle/)) {
                if (!request.rootResourcePath || openPage == tabEditors.getPage()) {
                    request.rootResourcePath = path;
                }
            }
        }
        
        if (!request.rootResourcePath) {
            request.rootResourcePath = settings.model.queryNode("latex/compiler").getAttribute("main_path");
        }
        
        if (!request.rootResourcePath) {
            winNoRootResource.show();
            this.setState("done");
            return;
        }
        
        request.resources = [];
        for (i = 0; i < this.files.length; i++) {
            var file = this.files[i];
            if (openFiles[file.path]) {
                var content = openFiles[file.path];
                request.resources[i] = {
                    path    : file.path,
                    content : content
                };
            } else {
                request.resources[i] = {
                    path     : file.path,
                    modified : file.modifieddate,
                    url      : document.location.origin + ide.davPrefix + "/" + file.path
                };
            }
        }
                        
        request = { compile: request };
        
        var self = this;
        apf.ajax(this.clsi.proxiedUrl + "/clsi/compile", {
            method      : "POST",
            contentType : "application/json",
            data        : apf.serialize(request),
            callback    : function(data, state, extra) {
                self.handleCLSIResponse.call(self, data, state, extra);
            }
        });
    },
    
    handleCLSIResponse: function(data, state, extra) {
        compile = JSON.parse(data).compile;
        
        this.status    = compile.status;
        var outputProduced = false;
        
        this.initOutputTabs();
        
        if (compile.output_files && compile.output_files.length > 0) {
            outputProduced = true;
            this.pdf = compile.output_files[0];
            this.setPdfTabToPdf(this.pdf.url);
            this.showPdfTab();
        } else {
            this.setPdfTabToNoPdf();
        }
        
        if (compile.logs && compile.logs.length > 0) {
            this.log = compile.logs[0];
            this.setState("parsingLog");
            this.fetchAndParseLog();
        } else {
            this.setState("done");
        }
        
        if (!outputProduced) {
            this.showLogTab();
        }
    },
    
    fetchAndParseLog: function() {
        var self = this;
        
        var proxiedLogUrl = this.log.url.slice(this.clsi.unproxiedUrl.length, this.log.url.length);
        proxiedLogUrl = this.clsi.proxiedUrl + proxiedLogUrl;
        
        apf.ajax(proxiedLogUrl, {
            method   : "GET",
            callback : function(data, state, extra) {
                self.log.content = data;
                self.setLogTabToLog(self.log.content);
                self.setState("done");
            }
        });
    },
    
    setState: function(state) {
        this.state = state;
        
        switch(this.state) {
        case "idle":
            btnCompile.enable();
            break;
        case "compiling":
            btnCompile.disable();
            break;
        case "parsingLog":
            btnCompile.disable();
            break;
        case "done":
            btnCompile.enable();
            if (this.sideBySide && colPdf.getWidth() < 10) {
                // Set the Pdf view to half the editor area.
                // For some reason we need to do this twice for it to work?
                splitterPanelPdf.update(
                    splitterPanelLeft.getLeft() + 
                    (colMiddle.getWidth() + colPdf.getWidth())/2
                );
                splitterPanelPdf.update(
                    splitterPanelLeft.getLeft() + 
                    (colMiddle.getWidth() + colPdf.getWidth())/2
                );
            }
        }
    },
    
    /* 
     * Iteratively fetches a list of the files in each directory of the project,
     * starting with the root directory. Afterwards, this.files will hold an
     * array of all files in the project, in the form
     *   {
     *     path: "path",
     *     modifieddate: "1 Jan 2010"
     *   }
     * 
     */
    $readDirectories : function(callback) {
        this.files = [];
        this.unprocessedDirectories = [];
        var self = this;
        
        function loadDirectoryIfNotLoaded(node, loadCallback) {
            // We delve deep into the apf private methods here so this is fragile.
            // The code is based on databindings.js in the apf framework.
            var loaded = node.getAttribute("a_loaded");
            if (!loaded || !loaded.match(/loaded/)) {
                var rule = trFiles.$getBindRule("insert", node);
                trFiles.getModel().$insertFrom(rule.getAttribute("get"), { 
                    xmlNode     : node,
                    insertPoint : node,
                    amlNode     : trFiles,
                    callback    : function() {
                        loadCallback();
                    }
                });
            } else {
                loadCallback();
            }
        }
        
        // We dig into the apf tree used to display files and make sure all
        // directories are loaded. We then traverse this tree to get all the
        // files in the project.
        function processNextDirectory(pndCallback) {
            var node = self.unprocessedDirectories.shift();
            loadDirectoryIfNotLoaded(node, function() {
                for (var i = 0; i < node.childNodes.length; i++) {
                    var childNode = node.childNodes[i];
                    var type = childNode.getAttribute("type")
                    if (type == "folder") {
                        self.unprocessedDirectories.push(childNode);
                    } else if (type == "file") {
                        var path = childNode.getAttribute("path");
                        path = path.slice(ide.davPrefix.length + 1, path.length);
                        self.files.push({
                            path : path,
                            modifieddate : childNode.getAttribute("modifieddate")
                        });
                    }
                }
                
                if (pndCallback)
                    pndCallback();
            });
        }
        
        var rootDir = trFiles.xmlRoot.childNodes[0];
        this.unprocessedDirectories.push(rootDir);
        
        processNextDirectory(function() {
            if (self.unprocessedDirectories.length > 0) {
                processNextDirectory(arguments.callee);
            } else {
                callback();
            }
        });
    },

    /* 
     * APF interprets content between { and } as bindings to data and
     * tries to replace it. These appear naturally in many strings to do
     * with LaTeX so we must escape every string we pass to APF.
     */
    $apfEscape : function(str) {
        if (typeof str === "string")
            return str.replace("{", "\\{").replace("}", "\\}");
        else
            return str;
    },

    duplicate : function() {
        var config = lstRunCfg.selected;
        if (!config)
            return;

        var duplicate = config.cloneNode(true);
        apf.b(config).after(duplicate);
        lstRunCfg.select(duplicate);
        winRunCfgNew.show();
    },

    enable : function(){
        if (!this.disabled) return;
        
        this.nodes.each(function(item){
            item.setProperty("disabled", item.$lastDisabled !== undefined
                ? item.$lastDisabled
                : true);
            delete item.$lastDisabled;
        });
        this.disabled = false;
    },

    disable : function(){
        if (this.disabled) return;
        
        this.nodes.each(function(item){
            if (!item.$lastDisabled)
                item.$lastDisabled = item.disabled;
            item.disable();
        });
        this.disabled = true;
    },

    destroy : function(){
        this.nodes.each(function(item){
            item.destroy(true, true);
        });
        this.nodes = [];
    }
});

});
