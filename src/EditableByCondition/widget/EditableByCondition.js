/*global logger*/
/*
    Default
    ========================

    @file      : EditableByCondition.js
    @version   : 1.5
    @author    : Ivo Sturm
    @date      : 26-3-2019
    @copyright : n/a
    @license   : Apache V2

    Documentation
    ========================
	v1.0: 	This widget lets you manage editability of a page based on a microflow or boolean attribute of the context object. 
			It is also possible to additionally grey out or hide specific buttons. For this functionality the buttons should get a specific class in the Modeler. 
			This class should be put into the widget as inputparameter.
			
			Be aware, this widget DOES NOT REPLACE ENTITY ACCESS FOR EDIT RIGHTS. A javascript savvy person could still in runtime change the editability of the inputfield and save the 
			object, with for instance some javascript code like: var widget = dijit.ById("mxui_widget_TextInput_3"); widget.set("disabled",false);
	
	v1.1	Fixed bug on button not showing when editable = false		
			Added support for ckEditor widget. For this, added dojo/_base/lang
			
	v1.2	Added editableOnTrue setting.
	
	v1.3	Added support for BooleanSlider widget with support of Alexander Assink.
	
	v1.4	Updated to Mendix 7.22.2 / Fix for 'Trying to unsubscribe using an invalid subscription handle'.
	
	v1.4.1	Fix for boolean slider in case of widget using a boolean attribute. Added a time out and implemented dojoAttr library to toggle disabling the boolean slider
	
	v1.5	Fix for subscriptions issue in case of multiple types of entities are subscribed
	
*/

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
define([
    "dojo/_base/declare",
	"dojo/NodeList-traverse",
    "mxui/widget/_WidgetBase",
	"mxui/dom",
	"dojo/dom-style",
	"dijit/registry",
	"dojo/_base/lang",
	"dojo/dom-attr",
], function(declare, NodeList, _WidgetBase, dom, domStyle, registry,lang,dojoAttr) {
    "use strict";

    // Declare widget's prototype.
    return declare("EditableByCondition.widget.EditableByCondition", [ _WidgetBase ], {

        // Parameters configured in the Modeler.
		booleanMicroflow: "",
		booleanAttribute: "",
		subscribeEntity: "",
		enableLogging: false,
		buttonClass: "",
		buttonDisable: false,
		editableOnTrue: true,
		
		// Internal variables. Non-primitives created in the prototype are shared between all widget instances.
        _handles: [],
        _contextObj: null,
		logNode: "EditableByCondition widget: ",
		_booleanSliderArray: [],

        // dojo.declare.constructor is called to construct the widget instance. Implement to initialize non-primitive properties.
        constructor: function() {

        },

        // dijit._WidgetBase.postCreate is called after constructing the widget. Implement to do extra setup work.
        postCreate: function() {
			this._handles = [];
			this.logNode = "EditableByCondition widget: ";
			this._contextObj = null;
			this.buttonDisplayArr = [];
			this._booleanSliderArray = [];
			this.source = "";
			
			if (this.booleanMicroflow==this.booleanAttribute){
				if (this.enableLogging){
					console.error(this.logNode +  "ill-configured. Choose either Microflow or Attribute as source");
				}
				this.source = 'Error';
			} else if (this.booleanMicroflow) {
				this.source = 'Microflow';			
			} else {
				this.source = 'Attribute';
			}
			
			this._updateRendering();
        },
		
		setEditable : function(editable) {
			if (this.enableLogging){
				console.log(this.logNode + "AttributeValue="+editable);
			}
			
			// find the enclosing dataview widget
			var widget = dijit.getEnclosingWidget(this.domNode.parentNode);

			if (widget){
				// get all children widgets for the enclosing widget	
				if (this.enableLogging){
					console.log(this.logNode + "main widget: ");
					console.dir(widget);
				}					
				var childWidgets = widget.getChildren(true);
				if (this.enableLogging){
					console.log(this.logNode + "Child Widgets found: " + childWidgets.length);
					console.dir(childWidgets);
				}
			}
			var countAttributeWidgets=0;
			// iterate over all children and setting their editability according to boolean variable / outcome of microflow
			if (childWidgets){

				for (var i = 0; i < childWidgets.length; i++) { 
					// disable edit on all boolean attributes, inputforms and reference lists. Exclude the boolean attribute itself, which can still be used to make the widget (non-)editable
					if ((childWidgets[i]._attrType || childWidgets[i]._attribute || childWidgets[i]._assoc) && childWidgets[i]._attribute !== this.booleanAttribute){
						childWidgets[i].set("disabled",!editable);
						countAttributeWidgets++;
					}
					// disable edit on all initially / conditionally hidden attributes, inputforms and reference lists
					if (childWidgets[i]._contentNode){
						childWidgets[i].readOnly=!editable;
						countAttributeWidgets++;
					}
					// disable buttons that with set class
					if (childWidgets[i].domNode.type==="button" && dojo.hasClass(childWidgets[i].domNode,this.buttonClass)){
						// store the initial style.display property of the buttons for when toggling editability on page. 
						if (!this.buttonDisplayArr[i]){
							var elem = childWidgets[i].domNode;
							if (elem.currentStyle) {
								this.buttonDisplayArr[i] = elem.currentStyle.display;
							} else if (window.getComputedStyle) {
								this.buttonDisplayArr[i] = window.getComputedStyle(elem, null).getPropertyValue("display");
							}				
						} 
						if (this.buttonDisable){
							childWidgets[i].readOnly=!editable;
							childWidgets[i].set("disabled",!editable);
						} else {
							// fix for when greyed out is no, button was never visible
							if (editable){
								domStyle.set(childWidgets[i].domNode, 'display', this.buttonDisplayArr[i]);
							} else {
								domStyle.set(childWidgets[i].domNode, 'display', 'none');
							}

						}
						countAttributeWidgets++;
					}
					// disable edit on CK Editor if in screen
					if (childWidgets[i]._CKEditor){

						this.ckEditor = childWidgets[i]._editor;
						// for the ckEditor add a timeout since it will always be loaded later then this widget.
						window.setTimeout(lang.hitch(this,function(){

							this.ckEditor.setReadOnly(!editable);
						
						}),500);
						countAttributeWidgets++;
					}
                    
                    // disable boolean slider
                    if (childWidgets[i].controlNode) {
                        var el = childWidgets[i].controlNode;

						// add all boolean sliders to an array to later on add a timeout on the full list. Adding time-outs one by one will not work with multiple boolean sliders on the page
                        if (el && dojo.hasClass(el, 'wgt-BooleanSlider_control')) {
							
							var booleanSlider = el.getElementsByTagName('input')[0];
							this._booleanSliderArray.push(booleanSlider);
								                            
                            countAttributeWidgets++;
                        }
                    }
					
					
					
				}

				if (this.enableLogging){
					console.log(this.logNode + "Attribute Child Widgets disabled: " + countAttributeWidgets);
				}
			}
			// for the boolean slider add a timeout since in case of this widget using a datasource microflow, the boolean slider is loaded later than this widget
			window.setTimeout(lang.hitch(this,function(){
									
				for (var k = 0 ; k < this._booleanSliderArray.length ; k++){
					//console.log(this._booleanSliderArray[k].parentNode.parentNode.parentNode.firstChild.innerHTML);
					if (!editable) {
						
						dojoAttr.set(this._booleanSliderArray[k], "disabled", "");
					} else {
						dojoAttr.remove(this._booleanSliderArray[k], "disabled");									
					}									
				
				}
			}),1000);
			
		},
	
        // mxui.widget._WidgetBase.update is called when context is changed or initialized. Implement to re-render and / or fetch data.
        update: function(obj, callback) {

			if (obj){
				this._contextObj = obj;
			}
            this._resetSubscriptions();
			if (this.enableLogging){
				console.log(this.logNode + " contextObj");
				console.dir(this._contextObj);
			}
			if (this._contextObj){
				this._updateRendering(this._contextObj.getGuid(),callback);
			} else {
				this._updateRendering();
			}
            typeof(callback) == "function" && callback();

        },
		_updateRendering: function(contextguid, callback){
			if (contextguid) {
				if (this.source === 'Microflow') {
					if (this.enableLogging){
						console.log(this.logNode + "Source=Microflow");
					}
					mx.data.action({
						params: {
							applyto: "selection",
							actionname: this.booleanMicroflow,
							guids: [contextguid]
						},
						callback: dojo.hitch(this, function (result) {
							this.setEditable(result);
						}),
						error: function(error) {
							console.log(error.description);
						}
					}, this);
				} else if (this.source === 'Attribute') {
					if (this.enableLogging){
						console.log(this.logNode + "Source=Attribute");
						console.log(this.logNode + ": AttributeName="+this.booleanAttribute);
					}
					// get actual value of attribute from mxObject
					this.booleanValue = this._contextObj.get(this.booleanAttribute);
					if (this.editableOnTrue){
						this.setEditable(this.booleanValue);
					} else {
						this.setEditable(!this.booleanValue);
					}

				}
			}
		},
		_resetSubscriptions: function() {
			this._removeSubscriptions();
			this._handles = [];
			this._addSubscriptions();
		},

		_removeSubscriptions: function() {
			this.unsubscribeAll();
		},
		// Reset subscriptions.
        _addSubscriptions: function() {
            // Release handles on previous object, if any.
			if (this._contextObj){
				var guid = this._contextObj.getGuid();
				var entityname  = this._contextObj.getEntity();
				this.unsubscribeAll();
				// Mendix in client API 6 advises to use this.subscribe over mx.data.subscribe
				// if a context object is found, subscribe to that specific object, irrespective whether source is microflow or attribute
				var contextHandle = this.subscribe({
					guid: guid,
					callback: dojo.hitch(this, function(entity) {
							if (this.enableLogging){
								console.log(this.logNode + " Update via guid on entity " + entityname + " with guid " + entity);
							}
							this._updateRendering(guid,this);
					})
				});
				if (this.enableLogging){
					console.log("contextHandle set on " + entityname + " with guid " + guid);
				}
				this._handles.push(contextHandle);
				
				// if boolean attribute is also set, register to changes on that boolean attribute
				if (this.booleanAttribute){
					var attrHandle = this.subscribe({
						guid: this._contextObj.getGuid(),
						attr: this.booleanAttribute,
						callback: dojo.hitch(this, function(guid, attr, value) {
								if (this.enableLogging){
									console.log("Object with guid " + guid + " had its attribute " +
									attr + " change to " + value);
								}				
								if (this.editableOnTrue){
									this.setEditable(value);
								} else {
									this.setEditable(!value);
								}
						})
					});
					this._handles.push(attrHandle);
				}
			}		
            
            if (this.source !== 'Microflow') {
                // if source is attribute subscribe to changes in generic entity as well
                var entityHandle = this.subscribe({
                    entity: this.subscribeEntity,
                    callback: dojo.hitch(this, function(entity) {
                            if (this.enableLogging){
                                console.log(this.logNode + " Update via entity class on entity " + entity);
                            }
                            this._updateRendering();

                    })
                });
                this._handles.push(entityHandle);
            }
			

			
			if (this.enableLogging){
				console.log(this.logNode + "subscriptions: ");
				console.dir(this._handles);
			}
            
        },
        // mxui.widget._WidgetBase.uninitialize is called when the widget is destroyed. Implement to do special tear-down work.
        uninitialize: function() {
          //logger.debug(this.id + ".uninitialize");
            // Clean up listeners, helper objects, etc. There is no need to remove listeners added with this.connect / this.subscribe / this.own.
        },
    });
});

require(["EditableByCondition/widget/EditableByCondition"], function() {
    "use strict";
});
