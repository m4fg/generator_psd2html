/*
 * Copyright (c) 2013 Adobe Systems Incorporated. All rights reserved.
 *  
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"), 
 * to deal in the Software without restriction, including without limitation 
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, 
 * and/or sell copies of the Software, and to permit persons to whom the 
 * Software is furnished to do so, subject to the following conditions:
 *  
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *  
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
 * DEALINGS IN THE SOFTWARE.
 * 
 */

 // Tutorial script by Tom Krcha (Twitter: @tomkrcha)

(function () {
    "use strict";

    var util = require("util");

    var PLUGIN_ID = require("./package.json").name,
        MENU_ID = "tutorial",
        MENU_LABEL = "$$$/JavaScripts/Generator/Tutorial/Menu=Tutorial";
    
    var _generator = null,
        _currentDocumentId = null,
        _config = null;

    var _SONToCSSConverter = null;

    var _html = "",
        _css = "";

    /*********** INIT ***********/

    function init(generator, config) {
        _generator = generator;
        _config = config;

        console.log("initializing generator getting started tutorial with config %j", _config);
        
        _generator.addMenuItem(MENU_ID, MENU_LABEL, true, false).then(
            function () {
                console.log("Menu created", MENU_ID);
            }, function () {
                console.error("Menu creation failed", MENU_ID);
            }
        );
        _generator.onPhotoshopEvent("generatorMenuChanged", handleGeneratorMenuClicked);

        function initLater() {
            // Flip foreground color
            // var flipColorsExtendScript = "var color = app.foregroundColor; color.rgb.red = 255 - color.rgb.red; color.rgb.green = 255 - color.rgb.green; color.rgb.blue = 255 - color.rgb.blue; app.foregroundColor = color;";
            // sendJavascript(flipColorsExtendScript);

            // _generator.onPhotoshopEvent("currentDocumentChanged", handleCurrentDocumentChanged);
            // _generator.onPhotoshopEvent("imageChanged", handleImageChanged);
            // _generator.onPhotoshopEvent("toolChanged", handleToolChanged);
            requestEntireDocument();
            
        }
        
        process.nextTick(initLater);

        _SONToCSSConverter = new SONToCSS(generator, config);

    }

    /*********** EVENTS ***********/

    function handleCurrentDocumentChanged(id) {
        console.log("handleCurrentDocumentChanged: "+id)
        setCurrentDocumentId(id);
    }

    function handleImageChanged(document) {
        console.log("Image " + document.id + " was changed:");//, stringify(document));
    }

    function handleToolChanged(document){
        console.log("Tool changed " + document.id + " was changed:");//, stringify(document));
    }

    function handleGeneratorMenuClicked(event) {
        // Ignore changes to other menus
        var menu = event.generatorMenuChanged;
        if (!menu || menu.name !== MENU_ID) {
            return;
        }

        var startingMenuState = _generator.getMenuState(menu.name);
        console.log("Menu event %s, starting state %s", stringify(event), stringify(startingMenuState));
    }

    /*********** CALLS ***********/

    function requestEntireDocument(documentId) {
        if (!documentId) {
            console.log("Determining the current document ID");
        }
        
        _html = "";
        _css = "";
        _generator.getDocumentInfo(documentId).then(
            function (document) {
                // console.log("Received complete document:", stringify(document.layers));
                procLayers(document.layers);
            },
            function (err) {
                console.error("[Tutorial] Error in getDocumentInfo:", err);
            }
        ).done(() => {
            console.log('----css------------------------');
            console.log(_css);
            console.log('----html------------------------');
            console.log(_html);
        });
    }

    function procLayers(layers, depth=0, artboard=null) {
        // console.log('procLayers');
        layers.forEach((val, idx) => {
            let output = '';
            for(var i=0; i<depth; i++) {
                output += '  ';
            }
            output += val.name + '  (' + val.type + ')';
            // console.log(output);
            if (val.type == 'artboardSection') {
                console.log(val.name + '---------------');
                if (val.layers) {
                    // console.log(stringify(val));
                    procLayers(val.layers, depth+1, val);
                }
            } else if (val.name.match(/^#/)) {
                var cssom = '';
                if (val.layers) {
                    procLayers(val.layers, depth+1, artboard);
                }
            } else if (val.type == 'textLayer' && val.name.match(/\.(txt)$/)) {
                // console.log(stringify(val));
                var bounds = val.boundsWithFX ? val.boundsWithFX : val.bounds;

                var son = extractStyleInfo({layers: [val]});
                var cssom = _SONToCSSConverter.toCSS(son.layers);
                var css = _SONToCSSConverter.toCSSText(cssom);
                // console.log(cssom);
                // console.log(stringify(val.text.textStyleRange));
                
                if (artboard) {
                    // console.log(artboard);
                    var top = bounds.top - artboard.bounds.top;
                    var left = bounds.left - artboard.bounds.left;
                    var text = val.text.textKey;
                    // console.log('text: ' + text + ' length:' + text.length);

                    _css += ('.' + val.name.replace('.txt', '') + ' { position: absolute; top: ' + top + 'px; left: ' + left + 'px; }') + "\n";
                    _html += '<div class="' + val.name.replace('.txt', '') + '">' + "\n";
                    val.text.textStyleRange.forEach((v, idx) => {
                        var t = text.substring(v.from, v.to).replace("\r", "<br>");
                        _css += ('.' + val.name.replace('.txt', '') + '_' + idx + ' { font-family: "' + v.textStyle.fontName + '"; font-weight: ' + v.textStyle.fontStyleName.toLowerCase().replace('regular', 'normal') + '; font-size: ' + Math.round(v.textStyle.size) + 'px; color: rgb(' + Math.round(v.textStyle.color.red) + ',' + Math.round(v.textStyle.color.green) + ',' + Math.round(v.textStyle.color.blue) + '); }') + "\n";
                        _html += '  <span class="' + val.name.replace('.txt', '') + '_' + idx + '">' + t + '</span>' + "\n";
                    });
                    _html += '</div>' + "\n";
                }
            } else if (val.name.match(/\.(png|jpg)$/)) {
                // console.log(stringify(artboard));
                // console.log(stringify(val));
                var bounds = val.boundsWithFX ? val.boundsWithFX : val.bounds;
                // if (val.name.substr(0, 4) == 'ch_g') {
                    // console.log('.' + val.name.replace('.png', '') + ' { top: ' + ((bounds.top-0)/1) + 'px; left: ' + ((bounds.left - 1920)/2) + 'px; }');
                // }

                if (artboard) {
                    //sp
                    _css += ('.' + val.name.replace('.png', '') + ' { position: absolute; @include ir(\'' + val.name + '\'); top: ' + ((bounds.top - artboard.bounds.top)/1) + 'px; left: ' + ((bounds.left - artboard.bounds.left)/1) + 'px; }') + "\n";
                    _html += '<div class="' + val.name.replace('.png', '') + '"></div>' + "\n";
                } else {
                    //pc
                    // if (val.name.substr(0, 2) == 'ch') {
                    //     console.log('.' + val.name.replace('.png', '') + ' { top: ' + ((bounds.top-0)/1) + 'px; left: ' + ((bounds.left - 1920/2)/1) + 'px; }');
                    // }
                    //sp
                    _css += ('.' + val.name.replace('.png', '') + ' { position: absolute; @include ir(\'' + val.name + '\'); top: ' + ((bounds.top-0)/1) + 'px; left: ' + ((bounds.left)/1) + 'px; }') + "\n";
                    _html += '<div class="' + val.name.replace('.png', '') + '"></div>' + "\n";
                }
            } else if (val.layers) {
                procLayers(val.layers, depth+1, artboard);
            }
        });
    }

    function updateMenuState(enabled) {
        console.log("Setting menu state to", enabled);
        _generator.toggleMenu(MENU_ID, true, enabled);
    }

    /*********** HELPERS ***********/


    function sendJavascript(str){
        _generator.evaluateJSXString(str).then(
            function(result){
                console.log(result);
            },
            function(err){
                console.log(err);
            });
    }

    function setCurrentDocumentId(id) {
        if (_currentDocumentId === id) {
            return;
        }
        console.log("Current document ID:", id);
        _currentDocumentId = id;
    }

    function stringify(object) {
        try {
            return JSON.stringify(object, null, "    ");
        } catch (e) {
            console.error(e);
        }
        return String(object);
    }

    exports.init = init;

    // Unit test function exports
    exports._setConfig = function (config) { _config = config; };
    
    // var MENU_ID = "css-document-menu-string";
    // var MENU_LABEL = "Copy Layer CSS to Clipboard";
    
    function interpolateValue(beginValue, endValue, fraction) {
        return fraction * (endValue - beginValue) + beginValue;
    }

    function radians(degrees) {
        return degrees * Math.PI / 180;
    }

    function degrees(radians) {
        return radians / Math.PI * 180;
    }
    
    function getPSGradientLength(width, height, angle) {
        while (angle < 0) {
            angle += 360;
        }

        angle %= 360;

        var hl = Math.abs(height / 2 / Math.cos(radians(angle)));
        var hw = Math.abs(width / 2 / Math.sin(radians(angle)));

        if (hw < hl) {
            return hw;
        }

        return hl;
    }

    function SONToCSS(generator, config, logger, documentManager) {
        this._generator = generator;
        this._config = config;
        this._logger = logger;
        this._documentManager = documentManager;
        this.classnames = [];

        this._currentDocument = null;
        this._currentSelectionListener = null;

        var self = this;

        function onMenuClick(event) {
            var menu = event.generatorMenuChanged;
            if (!menu) {
                return;
            }

            if (menu.name === MENU_ID) {
                self.convert({});
            }
        }

        function onActiveDocumentChange(docID) {
            // Disable listener for prior document
            if (self._currentDocument) {
                self._currentDocument.removeListener("selection", self._currentSelectionListener);
                self._currentDocument = null;
                self._currentSelectionListener = null;
            }

            if (!docID) { // no current document, so disable menu
                self._generator.toggleMenu(MENU_ID, false, false);
            } else {
                self._documentManager.getDocument(docID)
                .then(function (doc) {
                    self._currentDocument = doc;

                    self._currentSelectionListener = function () {
                        var enabled = Object.keys(doc.selection).length > 0;
                        self._generator.toggleMenu(MENU_ID, enabled, false);
                    };

                    doc.on("selection", self._currentSelectionListener);

                    // Update menu by pretending to fire a selection event
                    self._currentSelectionListener();

                });
            }
        }

        // for export to CSS
        // self._generator.addMenuItem(MENU_ID, MENU_LABEL, true, false);
        // self._generator.onPhotoshopEvent("generatorMenuChanged", onMenuClick);
        // self._documentManager.on("activeDocumentChanged", onActiveDocumentChange);

    }

    SONToCSS.prototype.getLength = function (unit) {
        if (unit !== undefined) {
            return unit + "px";
        }
    };

    SONToCSS.prototype.getLengthFunction = function (name) {
        return (function () {
            return function (layer) {
                if (layer[name] !== undefined) {
                    return layer[name] + "px";
                }
            };
        })();
    };
    
    SONToCSS.prototype.getColor = function (c, alpha, rgbonly, width, height) {
        if (c === undefined) {
            return undefined;
        }
        if (alpha === undefined) {
            alpha = 1;
        }
            
        if (c.type === "rgb") {
            if (alpha < 1) {
                return "rgba(" + Math.round(c.red * 255) + ", " +
                    Math.round(c.green * 255) + ", " +
                    Math.round(c.blue * 255) + ", " +
                    alpha + ")";
            } else {
                return "rgb(" + Math.round(c.red * 255) + ", " +
                    Math.round(c.green * 255) + ", " +
                    Math.round(c.blue * 255) + ")";
            }
        } else if (rgbonly) {
            // throw?
            return undefined;
        } else if (c.type === "angle-gradient") {
            var grad = "";
            switch (c.gradientType) {
                case "linear":
                    grad = "linear-gradient(";
                    //if (c.angle)
                    grad += c.angle + "deg, ";
                    break;
                case "radial":
                    grad = "radial-gradient(circle, ";
                    break;
                default:
                    // ?? throw or create image ?
            }
            
            // solve midpoints first
            // TODO!
            
            var colors = c.colorstops.map(function (stop) {
                return {r: stop.color.red, g: stop.color.green, b: stop.color.blue, p: stop.position};
            });
            var alphastops = c.alphastops.map(function (stop) {
                return {alpha: stop.alpha * alpha, position: stop.position};
            });
            
            var color;
            // add alpha stop with right colors
            alphastops.forEach(function (stop) {
                for (var x = 0; x < colors.length; x++) {
                    if (colors[x].p === stop.position) {
                        colors[x].a = stop.alpha;
                        break;
                    } else if (colors[x].p > stop.position) {
                        color = { p: stop.position, a: stop.alpha};
                        if (x === 0) {
                            color.r = colors[x].r;
                            color.g = colors[x].g;
                            color.b = colors[x].b;
                        } else {
                            var fraction = (color.p - colors[x - 1].p) / (colors[x].p - colors[x - 1].p);
                            color.r = interpolateValue(colors[x - 1].r, colors[x].r, fraction);
                            color.g = interpolateValue(colors[x - 1].g, colors[x].g, fraction);
                            color.b = interpolateValue(colors[x - 1].b, colors[x].b, fraction);
                        }
                        colors.splice(x, 0, color);
                        break;
                    }
                }
                
                if (x === colors.length) {
                    color = { p: stop.position, a: stop.alpha};
                    color.r = colors[x - 1].r;
                    color.g = colors[x - 1].g;
                    color.b = colors[x - 1].b;
                    colors.push(color);
                }
            });
            
            // calculate missing alpha
            for (var x = 0; x < colors.length; x++) {
                if (colors[x].a === undefined) {
                    if (x === 0) {
                        colors[x].a = colors[x + 1].a;
                    } else if (x === colors.length - 1) {
                        colors[x].a = colors[x - 1].a;
                    } else {
                        for (var y = x + 1 ; y < colors.length; y++) {
                            if (colors[y].a !== undefined) {
                                break;
                            }
                        }
                        var fraction = (colors[x].p - colors[x - 1].p) / (colors[y].p - colors[x - 1].p);
                        colors[x].a = interpolateValue(colors[x - 1].a, colors[y].a, fraction);
                    }
                }
            }

            var multiplier;
            var length;
            var pslength;
            
            if (c.gradientType === "linear") {
                // adjust stop position for %#$#^#$^# CSS positioning
                pslength = getPSGradientLength(width, height, c.angle);
                
                var hyp = Math.sqrt(width * width / 4 + height * height / 4);
                var baseangle = degrees(Math.asin(width / 2 / hyp));
                var angle = c.angle;
    
                // normalize angle
                while (angle < 0) {
                    angle += 360;
                }
                angle %= 360;
    
                var reducedAngle = angle % 180;
                if (reducedAngle > 90) {
                    reducedAngle = 180 - reducedAngle;
                }
                if (reducedAngle <= baseangle) {
                    length = hyp * Math.cos(radians(baseangle - reducedAngle));
                } else {
                    length = hyp * Math.cos(radians(reducedAngle - baseangle));
                }
                    
                var offset = (length - pslength) / length / 2;
                multiplier = pslength / length;
                
                colors.forEach(function (stop) {
                    stop.p = offset + stop.p * multiplier;
                });
            } else if (c.gradientType === "radial") {
                length = Math.sqrt(width * width + height * height) / 2;
                pslength = getPSGradientLength(width, height, c.angle);
                
                multiplier = pslength / length;
                
                colors.forEach(function (stop) {
                    stop.p = stop.p * multiplier;
                });
            }
            
            colors.forEach(function (stop) {
                if (stop.a === 1) {
                    grad += "rgb(" + Math.round(stop.r * 255) + ", " +
                            Math.round(stop.g * 255) + ", " +
                            Math.round(stop.b * 255) + ") " + Math.round(stop.p * 100) + "%, ";
                } else {
                    grad += "rgba(" + Math.round(stop.r * 255) + ", " +
                            Math.round(stop.g * 255) + ", " +
                            Math.round(stop.b * 255) + ", " +
                            stop.a + ") " + Math.round(stop.p * 100) + "%, ";
                }
            });
            
            grad = grad.slice(0, -2) + ")";
            
            return grad;
        }
    };
    
    SONToCSS.prototype.getBlendMode = function (layer) {
        switch (layer.blendMode) {
            case "pass-Through":
            case "normal":
            case "multiply":
            case "screen":
            case "overlay":
            case "darken":
            case "lighten":
            case "color-dodge":
            case "color-burn":
            case "hard-light":
            case "soft-light":
            case "difference":
            case "exclusion":
            case "hue":
            case "saturation":
            case "color":
            case "luminosity":
                return layer.blendMode;
            default:
                // throw?
        }
        
        return undefined;
    };
    
    SONToCSS.prototype.toCSS = function (SON) {
        var self = this;
        var css = {};
        
        var commonFetchers = {
            "required": {
                "top" : this.getLengthFunction ("top"),
                "left" : this.getLengthFunction ("left"),
                "width" : this.getLengthFunction ("width"),
                "height" : this.getLengthFunction ("height"),
                "position": function () { return "absolute"; }
            },
            "optional": {
                "opacity": function (layer) { return layer.opacity; },
                "mix-blend-mode": this.getBlendMode
            }
        };
        
        var specificFetchers = {
            "shape-layer" : {
                required: {},
                optional: {
                    "background": function (layer) {
                        return self.getColor(layer.color, layer.fillOpacity, false, layer.width, layer.height);
                    },
                    "border-radius": function (layer) {
                        if (layer.topLeftRadius === undefined) {
                            return undefined;
                        }
                        
                        var retval = self.getLength(layer.topLeftRadius);
                        if ((layer.topRightRadius === undefined) &&
                            (layer.bottomLeftRadius === undefined) &&
                            (layer.bottomRightRadius === undefined)) {
                            return retval;
                        }
                        
                        if (layer.topRightRadius === undefined) {
                            retval += " " + self.getLength(layer.topLeftRadius);
                        } else {
                            retval += " " + self.getLength(layer.topRightRadius);
                        }
                            
                        if (layer.bottomRightRadius === undefined) {
                            retval += " " + self.getLength(layer.topLeftRadius);
                        } else {
                            retval += " " + self.getLength(layer.bottomRightRadius);
                        }
                        
                        if (layer.bottomLeftRadius === undefined) {
                            retval += " " + self.getLength(layer.topLeftRadius);
                        } else {
                            retval += " " + self.getLength(layer.bottomLeftRadius);
                        }
                            
                        return retval;
                    },
                    "effects": function (layer) {
                        if (layer.layerEffects === undefined) {
                            return undefined;
                        }
                        
                        var retval = {};
                        var s;

                        layer.layerEffects.forEach(function (effect) {
                            if (effect.type === "inner-shadow") {
                                s  = "inset ";
                                s += self.getLength(-Math.cos(Math.PI * effect.angle / 180) * effect.distance);
                                s += " " + self.getLength(Math.sin(Math.PI * effect.angle / 180) * effect.distance);
                                s += " " + self.getLength(effect.blur);
                                s += " " + self.getLength(effect.spread);
                                s += " " + self.getColor(effect.color, effect.opacity, true);
                                if (retval["box-shadow"] !== undefined) {
                                    retval["box-shadow"] += ", " + s;
                                } else {
                                    retval["box-shadow"] = s;
                                }
                            } else if (effect.type === "drop-shadow") {
                                s  = self.getLength(-Math.cos(Math.PI * effect.angle / 180) * effect.distance);
                                s += " " + self.getLength(Math.sin(Math.PI * effect.angle / 180) * effect.distance);
                                s += " " + self.getLength(effect.blur);
                                s += " " + self.getLength(effect.spread);
                                s += " " + self.getColor(effect.color, effect.opacity, true);
                                if (retval["box-shadow"] !== undefined) {
                                    retval["box-shadow"] += ", " + s;
                                } else {
                                    retval["box-shadow"] = s;
                                }
                            }
                        });
                        
                        return retval;
                    },
                    "border": function (layer) {
                        if (layer.stroke === undefined) {
                            return undefined;
                        }
                            
                        var s = layer.stroke;
                        if (s.dashes && s.dashes.length) {
                            return undefined; // TODO
                        }
                            
                        if (s.lineJoin !== "miter") {
                            return undefined; // TODO
                        }
                            
                        var retval = {};
                        
                        retval["border-style"] = "solid";
                        retval["border-width"] = self.getLength(s.lineWidth);
                        retval["border-color"] = self.getColor(s.color, s.alpha, true);
                        
                        return retval;
                    }
                }
            },
            "text-layer" : {
                required: {},
                optional: {
                    "margin" : function () { return "0"; },
                    "effects": function (layer) {
                        if (layer.layerEffects === undefined) {
                            return undefined;
                        }
                        
                        var retval = {};
                        layer.layerEffects.forEach(function (effect) {
                            if (effect.type === "drop-shadow") {
                                var s  = self.getLength(-Math.cos(Math.PI * effect.angle / 180) * effect.distance);
                                s += " " + self.getLength(Math.sin(Math.PI * effect.angle / 180) * effect.distance);
                                s += " " + self.getLength(effect.blur);
                                
                                s += " " + self.getColor(effect.color, effect.opacity, true);
                                retval["text-shadow"] = s;
                            }
                        });
                        
                        return retval;
                    }
                },
                nthchild: {
                    "color": function (layer) {
                        if (layer["font-color"] === undefined) {
                            return undefined;
                        }
                        return layer["font-color"].map(function (color) {
                            return self.getColor(color, layer.fillOpacity, true);
                        });
                    },
                    "font-family": function (layer) {
                        if (layer["font-family"] === undefined) {
                            return undefined;
                        }
                        return layer["font-family"];
                    },
                    "font-size": function (layer) {
                        if (layer["font-size"] === undefined) {
                            return undefined;
                        }
                        return layer["font-size"].map(function (font) {
                            return font + "px";
                        });
                    },
                    "font-style": function (layer) {
                        if (layer["font-style"] === undefined) {
                            return undefined;
                        }
                        return layer["font-style"];
                    },
                    "font-weight": function (layer) {
                        if (layer["font-weight"] === undefined) {
                            return undefined;
                        }
                        return layer["font-weight"];
                    },
                    "text-align": function (layer) {
                        if (layer["font-align"] === undefined) {
                            return undefined;
                        }
                        return layer["font-align"];
                    }
                }
            },
            "group-layer" : {
                required: {},
                optional: {}
            }
        };
        
        function unroll(result, property, input) {
            if (typeof input === "string") {
                result[property] = input;
            } else {
                for (var x in input) {
                    if (input.hasOwnProperty(x)) {
                        result[x] = input[x];
                    }
                }
            }
        }
        
        function parseLayer(layer) {
            var retval = {};
            css[layer.name] = retval;
            for (var property in commonFetchers.required) {
                if (commonFetchers.required.hasOwnProperty(property)) {
                    unroll(retval, property, commonFetchers.required[property](layer));
                }
            }
            
            var value;
            for (property in commonFetchers.optional) {
                if (commonFetchers.optional.hasOwnProperty(property)) {
                    value = commonFetchers.optional[property](layer);
                    if (value !== undefined) {
                        unroll(retval, property, value);
                    }
                }
            }
            
            var specificFetcher = specificFetchers[layer.type];
            var f;

            if (specificFetcher !== undefined) {
                for (property in specificFetcher.required) {
                    if (specificFetcher.required.hasOwnProperty(property)) {
                        f = specificFetcher.required[property];
                        unroll(retval, property, (typeof f === "string") ? layer[f] : f(layer));
                    }
                }
            
                for (property in specificFetcher.optional) {
                    if (specificFetcher.optional.hasOwnProperty(property)) {
                        f = specificFetcher.optional[property];
                        value = (typeof f === "string") ? layer[f] : f(layer);
                        if (value !== undefined) {
                            unroll(retval, property, value);
                        }
                    }
                }
                
                if (specificFetcher.nthchild !== undefined) {
                    for (property in specificFetcher.nthchild) {
                        if (specificFetcher.nthchild.hasOwnProperty(property)) {
                            var array = specificFetcher.nthchild[property](layer);
                            if (array !== undefined) {
                                for (var x = 0; x < array.length; x++) {
                                    var spanname = layer.name + " span:nth-child(" + (x + 1) + ")";
                                    if (css[spanname] === undefined) {
                                        css[spanname] = {};
                                    }
                                    css[spanname][property] = array[x];
                                }
                            }
                        }
                    }
                }
            }
            
            if (layer.type === "group-layer") {
                layer.layers.forEach(parseLayer);
            }

        }
        
        SON.forEach(parseLayer);

        return css;
    };

    SONToCSS.prototype.toCSSText = function (son) {
        var _formatContext = {
            indent: "  ", /* Default to 2 spaces*/
            terminator: "\n",
            encoding: "utf8",
            generateSelectors: true
        };
        
        function Line(ctx) {
            var _c = ctx;
            var _l = [];
            var _indent = 0;
            /*jshint validthis:true */
            
            function _toBuffer() {
                return new Buffer(_l.join(""), _c.encoding);
            }
            
            // New line begins; generate indents
            this.begin = function () {
                _l = [];
                for (var i = 0; i < _indent; i++) {
                    _l.push(_c.indent);
                }
            };
            
            // Opening line begins: lines after this one must be indented
            this.open = function () {
                this.begin();
                _indent++;
            };
            
            // Closing line begins; remove an indent firt
            this.close = function () {
                _indent--;
                this.begin();
            };
            
            this.write = function () {
                var args = Array.prototype.slice.call(arguments);
                _l.push(util.format.apply(null, args));
            };
            
            // Line ends; return buffer, reset our line buffer
            this.end = function () {
                _l.push(_c.terminator);
                var ret = _toBuffer();
                _l = [];
                return ret;
            };

            // Line ends with an extra terminator
            this.endln = function () {
                _l.push(_c.terminator);
                return this.end();
            };

            this.crlf = function () {
                return this.end();
            };
        }

        var _lines = [];
        var line = new Line(_formatContext);
        
        var format = function (s) {
            line.begin();
            line.write(s);
            return line.end();
        };
        
        for (var rule in son) {
            if (son.hasOwnProperty(rule)) {
                _lines.push(format("." + rule + " {"));
                line.open();
                for (var cssrule in son[rule]) {
                    if (son[rule].hasOwnProperty(cssrule)) {
                        _lines.push(format(cssrule + ": " + son[rule][cssrule] + ";"));
                    }
                }
                line.close();
                _lines.push(format("}"));
            }
        }
        
        return Buffer.concat(_lines).toString(_formatContext.encoding);
    };

    SONToCSS.prototype.convert = function () {
        var self = this,
            docID = self._documentManager.getActiveDocumentID();

        if (docID) {
            self._generator._getStyleInfo(docID, { selectedLayers: true }).then(
                function (son) {
                    var cssom = self.toCSS(son.layers);
                    var css = self.toCSSText(cssom);
                    self._generator.copyToClipboard(css);
                }).done();
        }
    };

    var _origins = [{ x:0, y: 0}],
        _classnames = [],
        _psd;

    function pushOrigin(left, top) {
        _origins.push({ x: left, y:top });
    }

    function popOrigin() {
        if (_origins.length > 1) {
            _origins.pop();
        }
    }

    function getOrigin() {
        return _origins[_origins.length - 1];
    }

    function fetchWidth(layer) {
        var width;
        if (layer.bounds) {
            width = (layer.bounds.right - layer.bounds.left);
        }
        return width;
    }

    function fetchHeight(layer) {
        var height;
        if (layer.bounds) {
            height = (layer.bounds.bottom - layer.bounds.top);
        }
        return height;
    }

    function fetchFontFamily(layer) {
        if (layer.text && layer.text.textStyleRange) {

            return layer.text.textStyleRange.map(function (style) {
                return style.textStyle.fontName;
            });
        }
        return undefined;
    }

    function fetchFontSize(layer) {
        if (layer.text && layer.text.textStyleRange) {

            return layer.text.textStyleRange.map(function (style) {
                return style.textStyle.size.value || style.textStyle.size;
            });
        }
        return undefined;
    }

    function fetchFontWeight(layer) {
        if (layer.text && layer.text.textStyleRange) {
            return layer.text.textStyleRange.map(function (style) {
                var styleName = style.textStyle.fontStyleName;
                styleName = /bold/i.exec(styleName);
                if (styleName) {
                    return styleName[0].toLowerCase();
                }
                return "normal";
            });
        }
        return undefined;
    }

    function fetchFontStyle(layer) {
        if (layer.text && layer.text.textStyleRange) {
            return layer.text.textStyleRange.map(function (style) {
                var styleName = style.textStyle.fontStyleName;
                styleName = /italic/i.exec(styleName);
                if (styleName) {
                    return styleName[0].toLowerCase();
                }
                return "normal";
            });
        }
        return undefined;
    }
    
    function fetchFontAlign(layer) {
        if (layer.text && layer.text.paragraphStyleRange) {
            return layer.text.paragraphStyleRange.map(function (style) {
                if ((style.paragraphStyle !== undefined) && (style.paragraphStyle.align !== undefined)) {
                    return style.paragraphStyle.align.toLowerCase();
                }
                return "left";
            });
        }
        return undefined;
    }

    function fetchBorderRadius(layer) {
        var corners = [];
        var path = layer.path;

        if (path &&
            path.pathComponents &&
            path.pathComponents[0].origin.type === "roundedRect") {
            var radii = path.pathComponents[0].origin.radii;
            var topRight = radii[0];
            var bottomRight = radii[1];
            var bottomLeft = radii[2];
            var topLeft = radii[3];
            if (topLeft === topRight &&
                topLeft === bottomRight &&
                topLeft === bottomLeft) {
                // Most common case: all the same
                corners = [topLeft];
            } else {
                // For now, specify all four corners in all other cases
                corners = [topLeft, topRight, bottomLeft, bottomRight];
            }

        }
        return corners;
    }

    function fetchOpacity(layer) {
        var opacity;
        if (layer.blendOptions &&
            layer.blendOptions.opacity) {
            opacity = layer.blendOptions.opacity.value / 100;
        }
        return opacity;
    }

    function decamelcase(string) {
        return string.replace(/([A-Z])/g, "-$1").toLowerCase();
    }

    function fetchBlendMode(layer) {
        var blendMode;
        if (layer.blendOptions &&
            layer.blendOptions.mode) {
            blendMode = layer.blendOptions.mode;
            blendMode = decamelcase(blendMode);
        }

        if (blendMode === "pass-Through") {
            return "normal";
        }
        
        return blendMode;
    }

    function getRGBColor(input, divide) {
        if (divide === undefined) {
            divide = 255;
        }
        return {
            "type": "rgb",
            "red":  input.red ? (input.red / divide) : 0,
            "green": input.green ? (input.green / divide) : 0,
            "blue": input.blue ? (input.blue / divide) : 0
        };
    }

    function fetchBackgroundColor(layer) {
        var bgcolor;

        if (!layer.fill) {
            return {};
        }

        var fill = layer.fill;

        function getColorStops(colors) {
            return colors.map(function (color) {
                var stop = {};
                stop.position = color.location / 4096.0;
                stop.color = getRGBColor(color.color);
                stop.midpoint = color.midpoint / 100;
                return stop;
            });
        }

        function getAlphaStops(colors) {
            return colors.map(function (color) {
                var stop = {};
                stop.position = color.location / 4096.0;
                stop.alpha = color.opacity.value / 100;
                stop.midpoint = color.midpoint / 100;
                return stop;
            });
        }

        if (fill.class === "solidColorLayer") {
            bgcolor = getRGBColor(fill.color);
        } else if (fill.class === "gradientLayer") {
            bgcolor = {
                "type": "angle-gradient",
                "gradientType": fill.type,
                "angle": 270 - (fill.angle ? fill.angle.value : 0),
                "colorstops": getColorStops(fill.gradient.colors),
                "alphastops": getAlphaStops(fill.gradient.transparency)
            };
            /* jshint bitwise: false */
            if ((fill.reverse !== true) ^ (fill.type === "radial")) {
                bgcolor.colorstops.reverse().forEach(function (s) {
                    s.position = 1 - s.position; s.midpoint = 1 - s.midpoint;
                });
                bgcolor.alphastops.reverse().forEach(function (s) {
                    s.position = 1 - s.position; s.midpoint = 1 - s.midpoint;
                });
            }
        }

        return bgcolor;
    }
    
    function fetchFontColor(layer) {
        if (layer.text && layer.text.textStyleRange) {
            return layer.text.textStyleRange.map(function (style) {
                var color = style.textStyle.color;
                if (color !== undefined) {
                    return getRGBColor(color);
                }
                    
                return getRGBColor({});
            });
        }
        return undefined;
    }

    function fetchTop(layer) {
        var top;

        if (layer.bounds) {
            var o = getOrigin();
            top = layer.bounds.top - o.y;
        }

        return top;
    }

    function fetchLeft(layer) {
        var left;

        if (layer.bounds) {
            var o = getOrigin();
            left = layer.bounds.left - o.x;
        }

        return left;
    }
    
    function fetchEffects(layer) {
        if (layer.layerEffects === undefined) {
            return undefined;
        }
            
        var retval = [];
        var shadow = {};
        var effect;
        
        if (layer.layerEffects.innerShadow !== undefined &&
            layer.layerEffects.innerShadow.enabled) {
            retval.push(shadow);
            effect = layer.layerEffects.innerShadow;
            shadow.type = "inner-shadow";
            if (effect.mode === undefined) {
                shadow.mode = "multiply";
            } else {
                shadow.blendMode = effect.mode;
            }
            if (effect.opacity === undefined) {
                shadow.opacity = 0.75;
            } else {
                shadow.opacity = effect.opacity.value / 100;
            }
            shadow.distance = effect.distance;
            if (effect.blur === undefined) {
                shadow.blur = 5;
            } else {
                shadow.blur = effect.blur;
            }
            if (effect.chokeMatte === undefined) {
                shadow.spread = 0;
            } else {
                shadow.spread = effect.chokeMatte * shadow.blur / 100;
            }
            if (effect.localLightingAngle === undefined) {
                shadow.angle = _psd.globalLight.angle;
            } else {
                shadow.angle = effect.localLightingAngle.value;
            }
            if (effect.color === undefined) {
                shadow.color = getRGBColor({});
            } else {
                shadow.color = getRGBColor(effect.color);
            }
        }
        
        if ((layer.layerEffects.dropShadow !== undefined) &&
            layer.layerEffects.dropShadow.enabled) {
            retval.push(shadow);
            effect = layer.layerEffects.dropShadow;
            shadow.type = "drop-shadow";
            shadow.blendMode = effect.mode;
            if (effect.opacity === undefined) {
                shadow.opacity = 0.75;
            } else {
                shadow.opacity = effect.opacity.value / 100;
            }
            shadow.distance = effect.distance;
            if (effect.blur === undefined) {
                shadow.blur = 5;
            } else {
                shadow.blur = effect.blur;
            }
            if (effect.chokeMatte === undefined) {
                shadow.spread = 0;
            } else {
                shadow.spread = effect.chokeMatte * shadow.blur / 100;
            }
            if (effect.localLightingAngle === undefined) {
                shadow.angle = _psd.globalLight.angle;
            } else {
                shadow.angle = effect.localLightingAngle.value;
            }
            if (effect.color === undefined) {
                shadow.color = getRGBColor({});
            } else {
                shadow.color = getRGBColor(effect.color);
            }
        }
            
        return retval;
    }
    
    function fetchFillOpacity(layer) {
        if ((layer.blendOptions === undefined) || (layer.blendOptions.fillOpacity === undefined)) {
            return undefined;
        }
            
        return layer.blendOptions.fillOpacity.value / 100;
    }
    
    function fetchStroke(layer) {
        if (layer.strokeStyle === undefined) {
            return undefined;
        }
            
        var s = layer.strokeStyle;
        var strokeStyle = {};
        strokeStyle.color = getRGBColor(s.strokeStyleContent.color);
        strokeStyle.opacity = s.strokeStyleOpacity.value / 100;
        strokeStyle.lineWidth =  s.strokeStyleLineWidth.value;
        switch (s.strokeStyleLineCapType) {
            case "strokeStyleRoundCap":
                strokeStyle.lineCap = "round"; break;
            case "strokeStyleSquareCap":
                strokeStyle.lineCap = "square"; break;
            //case "strokeStyleButtCap":
            default:
                strokeStyle.lineCap = "butt";
        }
        switch (s.strokeStyleLineJoinType) {
            case "strokeStyleRoundJoin":
                strokeStyle.lineJoin = "round"; break;
            case "strokeStylebevelJoin":
                strokeStyle.lineJoin = "bevel"; break;
            //case "strokeStyleMiterJoin":
            default:
                strokeStyle.lineJoin = "miter";
        }
        
        strokeStyle.miterLimit = s.strokeStyleMiterLimit;
        strokeStyle.dashes = s.strokeStyleLineDashSet;
        
        strokeStyle.lineDashOffset = s.strokeStyleLineDashOffset.value;
        
        return strokeStyle;
    }

    function getCSSName(layer) {
        // We want to convert the layer name to a valid CSS IDENT
        var l = "layer" + layer.index;
        var wsSequence = false;

        function _toClass(c) {
            var ret = c;
            var skip = ".<>[]`~!@#$%^&*() {}|?/\\:;\"\',+";

            if (c.trim().length === 0) { // Whitespace?
                if (wsSequence === false) {
                    ret = "-"; // Convert first WS in a sequence to dash
                    wsSequence = true;
                } else {
                    ret = "";
                }
            } else {
                wsSequence = false;
            }

            if (skip.indexOf(c) >= 0) {
                ret = "";
            }

            return ret;
        }

        if (layer.name) {
            // Otherwise, lowercase everthing. Collapse 1+ whitespace to dash
            l = layer.name.toLowerCase();
            var buffer = l.split("");
            buffer = buffer.map(_toClass);
            l = buffer.join("") + "_" + layer.index;
        }

        return l;
    }

    var multiLayerFetchers = {
        "name": getCSSName,
        "top": fetchTop,
        "left": fetchLeft,
        "width": fetchWidth,
        "height": fetchHeight,
        "opacity": fetchOpacity,
        "blendMode": fetchBlendMode,
        "layerEffects": fetchEffects,
        "fillOpacity": fetchFillOpacity
    };

    var SpecializeFetchers = {
        "shapeLayer" : {
            "type" : function () { return "shape-layer"; },
            "color": fetchBackgroundColor,
            "topLeftRadius":  function (layer) { return fetchBorderRadius(layer)[0]; },
            "topRightRadius":  function (layer) { return fetchBorderRadius(layer)[1]; },
            "bottomLeftRadius":  function (layer) { return fetchBorderRadius(layer)[2]; },
            "bottomRightRadius": function (layer) { return fetchBorderRadius(layer)[3]; },
            "stroke": fetchStroke
        },
        "textLayer" : {
            "type" : function () { return "text-layer"; },
            "font-color": fetchFontColor,
            "font-family": fetchFontFamily,
            "font-size": fetchFontSize,
            "font-weight": fetchFontWeight,
            "font-style": fetchFontStyle,
            "font-align": fetchFontAlign,
            "stroke": fetchStroke
        },
        "layerSection" : {
            "type" : function () { return "group-layer"; },
            "layers": function (layer) {
                pushOrigin(layer.bounds.left, layer.bounds.top);
                var layers = [];
                if (layer.layers !== undefined) {
                    layer.layers.forEach(function (layer) {
                        var s = extractLayerStyleInfo(layer);
                        if (s !== undefined) {
                            layers.push(s);
                        }
                    });
                }
                popOrigin();
                return layers;
            }
        },
        "layer" : {
            "type" : function () { return "image-layer"; }
        },
        "backgroundLayer" : {
            "type" : function () { return "image-layer"; }
        }
    };

    function extractLayerStyleInfo(layer) {
        if (layer.visible === false) {
            return undefined;
        }
            
        var style = {};
        var value;

        // extract info common to all layers
        for (var property in multiLayerFetchers) {
            if (multiLayerFetchers.hasOwnProperty(property)) {
                value = multiLayerFetchers[property](layer);
                if (value !== undefined) {
                    style[property] = value;
                }
            }
        }

        var layerHandler = SpecializeFetchers[layer.type];
        //if (layerHandler === undefined) {
        // TODO: error
        //} else 
        for (property in layerHandler) {
            if (layerHandler.hasOwnProperty(property)) {
                value = layerHandler[property](layer);
                if (value !== undefined) {
                    style[property] = value;
                }
            }
        }
        
        return style;
    }

    /**
     * Return a SON document for the specified document info
     *
     * @param {Object} psd document retrieved from Generator.getDocumentInfo()
     *
     * @return {Object} The SON document for the specified Generator document 
     *
     * Note: This API should be considered private and may be changed/removed at any 
     * time with only a bump to the "patch" version number of generator-core. 
     * Use at your own risk.
     */
    function extractStyleInfo(psd/*, opts*/) {
        var SON = {};
        var layers = psd.layers;
        _classnames = [];
        _psd = psd;
        SON.layers = [];
        layers.forEach(function (layer) {
            var s = extractLayerStyleInfo(layer);
            if (s !== undefined) {
                SON.layers.push(s);
            }
        });

        return SON;
    }
}());
