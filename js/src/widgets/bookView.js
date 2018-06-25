(function($) {

  $.BookView = function(options) {

    jQuery.extend(this, {
      currentImg:       null,
      windowId:         null,
      currentImgIndex:  0,
      stitchList:       [],
      canvasID:          null,
      imagesList:       [],
      imagesListRtl:       [],
      element:          null,
      focusImages:      [],
      manifest:         null,
      viewingDirection: 'left-to-right',
      viewingHint:      'paged',
      osd:              null,
      osdCls:           'mirador-osd',
      osdOptions: {
        osdBounds:        null,
        zoomLevel:        null
      },
      stitchTileMargin: 10,
      eventEmitter: null,
      originalBoundsWidth:   null,
      setBoundsCounter: 3
    }, options);

    this.init();
  };


  $.BookView.prototype = {

    init: function() {
      var _this = this;

      if(this.vDirectionStatus == 'rtl'){
        this.imagesList =  this.imagesListRtl.concat();
      }
      if (this.canvasID !== null) {
        this.currentImgIndex = $.getImageIndexById(this.imagesList, this.canvasID);
      }

      if (!this.osdOptions) {
        this.osdOptions = {
          osdBounds:        null,
          zoomLevel:        null
        };
      }
      //loading message
      jQuery('.loading').fadeIn(400);

      this.currentImg = this.imagesList[this.currentImgIndex];

      this.element = jQuery(this.template()).appendTo(this.appendTo);

      this.hud = new $.Hud({
        appendTo: this.element,
        bottomPanelAvailable: this.bottomPanelAvailable,
        windowId: this.windowId,
        annotationLayerAvailable: false,
        showNextPrev : this.imagesList.length !== 1,
        eventEmitter: this.eventEmitter,
        showAnno: false,
        showImageControls: false
      });

      if (this.manifest.jsonLd.sequences[0].viewingDirection) {
        this.viewingDirection = this.manifest.jsonLd.sequences[0].viewingDirection.toLowerCase();
      }
      if (this.manifest.jsonLd.sequences[0].viewingHint) {
        this.viewingHint = this.manifest.jsonLd.sequences[0].viewingHint.toLowerCase();
      }

      this.stitchList = this.getStitchList();
      this.createOpenSeadragonInstance();

      this.bindEvents();
      this.listenForActions();

      if (typeof this.bottomPanelAvailable !== 'undefined' && !this.bottomPanelAvailable) {
        _this.eventEmitter.publish('SET_BOTTOM_PANEL_VISIBILITY.' + this.windowId, false);
      } else {
        _this.eventEmitter.publish('SET_BOTTOM_PANEL_VISIBILITY.' + this.windowId, null);
      }
    },

    template: $.Handlebars.compile([
      '<div class="book-view">',
      '</div>'
    ].join('')),

    listenForActions: function() {
      var _this = this,
          firstCanvasId = _this.imagesList[0]['@id'],
          lastCanvasId = _this.imagesList[_this.imagesList.length-1]['@id'];

      _this.eventEmitter.subscribe('bottomPanelSet.' + _this.windowId, function(event, visible) {
        var dodgers = _this.element.find('.mirador-osd-toggle-bottom-panel, .mirador-pan-zoom-controls');
        var arrows = _this.element.find('.mirador-osd-next, .mirador-osd-previous');
        var numberStatus = jQuery('.view-container').find('.status');
        var exhibitionTitle = _this.element.find('.exhibitionTitle');
        if (visible === true) {
          dodgers.addClass('bottom-panel-open');
          arrows.addClass('bottom-panel-open');
          exhibitionTitle.addClass('bottom-panel-open');
          numberStatus.css('display', 'block');
          _this.element.find('.seeAll').html('<svg width="12px" height="12px" viewBox="0 0 12 12" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"><g id="Menu-Open" transform="translate(-1272.000000, -850.000000)" stroke="#444444" stroke-width="1.5"><g id="icon_close_16" transform="translate(1273.000000, 851.000000)"><g id="icons"><path d="M0,0 L10,10" id="Shape"></path><path d="M10,0 L0,10" id="Shape"></path></g></g></g></g></svg></i>&nbsp;&nbsp;&nbsp;Close');
        } else {
          dodgers.removeClass('bottom-panel-open');
          arrows.removeClass('bottom-panel-open');
          numberStatus.css('display', 'none');
          exhibitionTitle.removeClass('bottom-panel-open');
          _this.element.find('.seeAll').html('<i class="fa fa-angle-down"></i>&nbsp;&nbsp;&nbsp;See all pages');
        }
      });

      _this.eventEmitter.subscribe('fitBounds.' + _this.windowId, function(event, bounds) {
        var rect = _this.osd.viewport.imageToViewportRectangle(Number(bounds.x), Number(bounds.y), Number(bounds.width), Number(bounds.height));
        _this.osd.viewport.fitBoundsWithConstraints(rect, false);
      });

      _this.eventEmitter.subscribe('currentCanvasIDUpdated.' + _this.windowId, function(event, canvasId) {
        //send google analytics
        ga('send', 'event', 'selection', 'image selected', _this.currentImgIndex+1);
        //loading message
        jQuery('.loading').fadeIn(400);

        //get width of new image
        _this.originalBoundsWidth = Math.round(_this.osd.viewport.getBounds(true).width);
        _this.osd.removeAllHandlers('canvas-drag-end'); 
        _this.swipeOn();

        //reset opacity on reset button
        _this.element.find('.mirador-osd-go-home').fadeOut();
        // If it is the first canvas, hide the "go to previous" button, otherwise show it.
        if (canvasId === firstCanvasId) {
          _this.element.find('.mirador-osd-previous').hide();
          _this.element.find('.mirador-osd-next').show();
        } else if (canvasId === lastCanvasId) {
          _this.element.find('.mirador-osd-next').hide();
          _this.element.find('.mirador-osd-previous').show();
        } else {
          _this.element.find('.mirador-osd-next').show();
          _this.element.find('.mirador-osd-previous').show();
        }
        // If it is the last canvas, hide the "go to previous" button, otherwise show it.
      });
    },

    bindEvents: function() {
      var _this = this;

      this.element.find('.mirador-osd-next').on('click', function() {
        _this.next();
        ga('send', 'event', 'controls', 'next', 'next button');
      });
      this.element.find('.mirador-osd-previous').on('click', function() {
        _this.previous();
        ga('send', 'event', 'controls', 'previous', 'previous button');
      });
      this.element.find('.mirador-osd-go-home').on('click', function() {
        _this.osd.viewport.goHome();
        //reset fade
        _this.element.find('.mirador-osd-go-home').fadeOut();
        //add swipe back in
        _this.swipeOn();
        ga('send', 'event', 'controls', 'reset', 'reset button');
      });
      this.element.find('.mirador-osd-up').on('click', function() {
        var panBy = _this.getPanByValue();
        _this.osd.viewport.panBy(new OpenSeadragon.Point(0, -panBy.y));
        _this.osd.viewport.applyConstraints();
      });
      this.element.find('.mirador-osd-right').on('click', function() {
        var panBy = _this.getPanByValue();
        _this.osd.viewport.panBy(new OpenSeadragon.Point(panBy.x, 0));
        _this.osd.viewport.applyConstraints();
      });
      this.element.find('.mirador-osd-down').on('click', function() {
        var panBy = _this.getPanByValue();
        _this.osd.viewport.panBy(new OpenSeadragon.Point(0, panBy.y));
        _this.osd.viewport.applyConstraints();
      });
      this.element.find('.mirador-osd-left').on('click', function() {
        var panBy = _this.getPanByValue();
        _this.osd.viewport.panBy(new OpenSeadragon.Point(-panBy.x, 0));
        _this.osd.viewport.applyConstraints();
      });

      this.element.find('.mirador-osd-zoom-in').on('click', function() {
        var osd = _this.osd;
        if ( osd.viewport ) {
          osd.viewport.zoomBy(
            osd.zoomPerClick / 1.0
          );
          osd.viewport.applyConstraints();
        }
      });
      this.element.find('.mirador-osd-zoom-out').on('click', function() {
        var osd = _this.osd;
        if ( osd.viewport ) {
          osd.viewport.zoomBy(
            1.0 / osd.zoomPerClick
          );
          osd.viewport.applyConstraints();
        }
      });

      this.element.find('.mirador-osd-toggle-bottom-panel').on('click', function() {
        _this.eventEmitter.publish('TOGGLE_BOTTOM_PANEL_VISIBILITY.' + _this.windowId);
        ga('send', 'event', 'controls', 'see all pages', 'see all pages panel');
      });
    },

    getPanByValue: function() {
      var bounds = this.osd.viewport.getBounds(true);
      //for now, let's keep 50% of the image on the screen
      var panBy = {
        "x" : bounds.width * 0.5,
        "y" : bounds.height * 0.5
      };
      return panBy;
    },

    setBounds: function() {
      var _this = this;

      _this.setBoundsCounter--;
      if (_this.setBoundsCounter == 0) {
        //get width of loaded image after setBounds executes 3 times
        _this.originalBoundsWidth = Math.round(_this.osd.viewport.getBounds(true).width);
      }
      
      this.osdOptions.osdBounds = this.osd.viewport.getBounds(true);
      _this.eventEmitter.publish("imageBoundsUpdated", {
        id: _this.windowId,
        osdBounds: {
          x: _this.osdOptions.osdBounds.x,
          y: _this.osdOptions.osdBounds.y,
          width: _this.osdOptions.osdBounds.width,
          height: _this.osdOptions.osdBounds.height
        }
      });

      _this.resetActions();
    },

    resetActions: function() {
      var _this = this;
      //removing handlers
      _this.osd.removeAllHandlers('canvas-pinch');
      _this.osd.removeAllHandlers('canvas-scroll');
      //actions on detecting zoom in via pinch gesture
      _this.osd.addHandler('canvas-pinch', function(event) {
        //remove swipe
        _this.osd.removeAllHandlers('canvas-drag-end');
        //get current width
        var myBounds = Math.round(_this.osd.viewport.getBounds(true).width);
        if (myBounds < _this.originalBoundsWidth)  {
          //if zoomed in, remove handlers and allow for panning, display reset button
          _this.osd.removeAllHandlers('canvas-drag-end');
          _this.osd.removeAllHandlers('canvas-release');
          _this.element.find('.mirador-osd-go-home').fadeIn();
          _this.osd.panHorizontal = true;
          _this.osd.panVertical = true;
        } else {
          //if zoomed out, remove reset button, panning and add swipe back in
          _this.element.find('.mirador-osd-go-home').fadeOut();
          _this.osd.addHandler('canvas-release', $.debounce(function(event) {
            //remove handlers on canvas release, and add back in
            _this.osd.removeAllHandlers('canvas-drag-end');
            _this.swipeOn();
          }, 30));
        }
      }); 
      //handling mouse scrolls
      _this.osd.addHandler('canvas-scroll', function(event) {
        var myBounds = Math.round(_this.osd.viewport.getBounds(true).width);
        if (myBounds < _this.originalBoundsWidth)  {
          //if zoomed in, remove handlers and allow for panning, display reset button
          _this.element.find('.mirador-osd-go-home').fadeIn();
          _this.osd.panHorizontal = true;
          _this.osd.panVertical = true;
          _this.osd.removeAllHandlers('canvas-drag-end');
        } else {
          //if zoomed out, remove reset button, panning
          _this.element.find('.mirador-osd-go-home').fadeOut();
          _this.osd.panHorizontal = false;
          _this.osd.panVertical = false;
        }
      });
    },

    toggle: function(stateValue) {
      if (stateValue) {
        this.show();
      } else {
        this.hide();
      }
    },

    hide: function() {
      jQuery(this.element).hide({effect: "fade", duration: 300, easing: "easeOutCubic"});
    },

    show: function() {
      jQuery(this.element).show({
        effect: "fade", duration: 300, easing: "easeInCubic", complete: function () {
          // Under firefox $.show() used under display:none iframe does not change the display.
          // This is workaround for https://github.com/IIIF/mirador/issues/929
          jQuery(this).css('display', 'block');
        }
      });
    },

    adjustWidth: function(className, hasClass) {
      var _this = this;
      if (hasClass) {
        _this.eventEmitter.publish('REMOVE_CLASS.'+this.windowId, className);
      } else {
        _this.eventEmitter.publish('ADD_CLASS.'+this.windowId, className);
      }
    },

    adjustHeight: function(className, hasClass) {
      if (hasClass) {
        this.element.removeClass(className);
      } else {
        this.element.addClass(className);
      }
    },

    updateImage: function(canvasID) {
      this.canvasID = canvasID;
      this.currentImgIndex = $.getImageIndexById(this.imagesList, this.canvasID);
      this.currentImg = this.imagesList[this.currentImgIndex];
      var newList = this.getStitchList();
      var is_same = this.stitchList.length == newList.length && this.stitchList.every(function(element, index) {
        return element === newList[index];
      });
      if (!is_same) {
        this.stitchList = newList;
        this.osdOptions = {
          osdBounds:        null,
          zoomLevel:        null
        };
        this.osd.close();
        this.createOpenSeadragonInstance();
      }
    },

    createOpenSeadragonInstance: function() {
      var uniqueID = $.genUUID(),
          osdId = 'mirador-osd-' + uniqueID,
          osdToolBarId = osdId + '-toolbar',
          elemOsd,
          tileSources = [],
          _this = this,
          toolbarID = 'osd-toolbar-' + uniqueID,
          dfd = jQuery.Deferred();

      this.element.find('.' + this.osdCls).remove();

      jQuery.each(this.stitchList, function(index, image) {
        var imageUrl = $.Iiif.getImageUrl(image),
            infoJsonUrl = imageUrl + '/info.json';

        jQuery.getJSON(infoJsonUrl).done(function (data, status, jqXHR) {
          tileSources.splice(index, 0, data);
          if (tileSources.length === _this.stitchList.length ) { dfd.resolve(); }
        });
      });

      dfd.done(function () {
        var aspectRatio = tileSources[0].height / tileSources[0].width;

        elemOsd =
          jQuery('<div/>')
          .addClass(_this.osdCls)
          .attr('id', osdId)
          .appendTo(_this.element);

        _this.osd = $.OpenSeadragon({
          'id':           elemOsd.attr('id'),
          'toolbarID' : toolbarID,
          //turn off pan at start to enable swipe
          'panHorizontal' : false,
          'panVertical' : false
        });
        //loading message
        jQuery('.loading').fadeOut(100);

        // if (_this.state.getStateProperty('autoHideControls')) {
        //   var timeoutID = null,
        //   fadeDuration = _this.state.getStateProperty('fadeDuration'),
        //   timeoutDuration = _this.state.getStateProperty('timeoutDuration');
        //   var hideHUD = function() {
        //     _this.element.find(".hud-control").stop(true, true).addClass('hidden', fadeDuration);
        //   };
        //   hideHUD();
        //   jQuery(_this.element).on('mousemove', function() {
        //     window.clearTimeout(timeoutID);
        //     _this.element.find(".hud-control").stop(true, true).removeClass('hidden', fadeDuration);
        //     timeoutID = window.setTimeout(hideHUD, timeoutDuration);
        //   }).on('mouseleave', function() {
        //     window.clearTimeout(timeoutID);
        //     hideHUD();
        //   });
        // }

        _this.osd.addHandler('open', function(){
          _this.addLayer(tileSources.slice(1), aspectRatio);
          var addItemHandler = function( event ) {
            _this.osd.world.removeHandler( "add-item", addItemHandler );
            if (_this.osdOptions.osdBounds) {
              var rect = new OpenSeadragon.Rect(_this.osdOptions.osdBounds.x, _this.osdOptions.osdBounds.y, _this.osdOptions.osdBounds.width, _this.osdOptions.osdBounds.height);
              _this.osd.viewport.fitBounds(rect, true);
            } else {
              _this.osd.viewport.goHome(true);
            }
          };

          if (_this.boundsToFocusOnNextOpen) {
            _this.eventEmitter.publish('fitBounds.' + _this.windowId, _this.boundsToFocusOnNextOpen);
            _this.boundsToFocusOnNextOpen = null;
          }

          _this.osd.world.addHandler( "add-item", addItemHandler );

          _this.osd.addHandler('canvas-drag-end', $.debounce(function(event) {
            //listen for swipe gesture
            _this.canvasDragHandler(event, _this);
          }, 300));

          _this.osd.addHandler('zoom', $.debounce(function(){
            ga('send', 'event', 'gestures', 'zoom', 'zoom image');
            _this.setBounds();
          }, 300));

          _this.osd.addHandler('pan', $.debounce(function(){
            ga('send', 'event', 'gestures', 'pan', 'move image');
            _this.setBounds();
          }, 300));
        });
        _this.osd.open(tileSources[0], {opacity:1, x:0, y:0, width:1});
      });

    },

    addLayer: function(tileSources, aspectRatio) {
      var _this = this;
      jQuery.each(tileSources, function(index, value) {
        var newAR = (value.height / value.width);
        var options = {
          tileSource: value,
          opacity: 1,
          x: 1.01,
          y: 0,
          width: aspectRatio / newAR
        };
        _this.osd.addTiledImage(options);
      });
    },

    // next two pages for paged objects
    // need next single page for lining pages up
    // don't need for continuous or individuals
    next: function() {
      var _this = this;
      var next;

      if (this.currentImgIndex % 2 === 0) {
        next = this.currentImgIndex + 1;
      } else {
        next = this.currentImgIndex + 2;
      }
      if (next < this.imagesList.length) {
        _this.eventEmitter.publish('SET_CURRENT_CANVAS_ID.' + this.windowId, this.imagesList[next]['@id']);
      }
    },

    // previous two pages for paged objects
    // need previous single page for lining things up
    // don't need for continuous or individuals
    previous: function() {
      var _this = this;
      var prev;

      if (this.currentImgIndex % 2 === 0) {
        prev = this.currentImgIndex - 2;
      } else {
        prev = this.currentImgIndex - 1;
      }

      if (prev >= 0) {
        _this.eventEmitter.publish('SET_CURRENT_CANVAS_ID.' + this.windowId, this.imagesList[prev]['@id']);
      }
    },

    canvasDragHandler: function(event, _this) {
      //handle swipe gesture
      if (event.direction > -1 && event.direction < 1) {
        _this.previous();
      } else {
        _this.next();
      }
    },

    swipeOn: function() {
      var _this = this;
      _this.osd.panHorizontal = false;
      _this.osd.panVertical = false;
      _this.osd.addHandler('canvas-drag-end', $.debounce(function(event) {
        //listen for swipe gesture
        _this.canvasDragHandler(event, _this);
      }, 30));
    },

    getStitchList: function() {
      // Need to check metadata for object type and viewing direction
      // Default to 'paged' and 'left-to-right'
      // Set index(es) for any other images to stitch with selected image
      var stitchList = [],
          leftIndex = [],
          rightIndex = [],
          topIndex = [],
          bottomIndex = [],
          _this = this;

      this.focusImages = [];

      if (this.viewingHint === 'individuals') {
        // don't do any stitching, display like an imageView
        stitchList = [this.currentImg];
      } else if (this.viewingHint === 'paged') {
        // determine the other image for this pair based on index and viewingDirection
        if (this.currentImgIndex === 0 || this.currentImgIndex === this.imagesList.length-1) {
          //first page (front cover) or last page (back cover), display on its own
          stitchList = [this.currentImg];
        } else if (this.currentImgIndex % 2 === 0) {
          // even, get previous page.  set order in array based on viewingDirection
          switch (this.viewingDirection) {
          case "left-to-right":
            leftIndex[0] = this.currentImgIndex-1;
            stitchList = [this.imagesList[this.currentImgIndex-1], this.currentImg];
            break;
          case "right-to-left":
            rightIndex[0] = this.currentImgIndex-1;
            stitchList = [this.currentImg, this.imagesList[this.currentImgIndex-1]];
            break;
          case "top-to-bottom":
            topIndex[0] = this.currentImgIndex-1;
            stitchList = [this.imagesList[this.currentImgIndex-1], this.currentImg];
            break;
          case "bottom-to-top":
            bottomIndex[0] = this.currentImgIndex-1;
            stitchList = [this.currentImg, this.imagesList[this.currentImgIndex-1]];
            break;
          default:
            break;
          }
        } else {
          // odd, get next page
          switch (this.viewingDirection) {
          case "left-to-right":
            rightIndex[0] = this.currentImgIndex+1;
            stitchList = [this.currentImg, this.imagesList[this.currentImgIndex+1]];
            break;
          case "right-to-left":
            leftIndex[0] = this.currentImgIndex+1;
            stitchList = [this.imagesList[this.currentImgIndex+1], this.currentImg];
            break;
          case "top-to-bottom":
            bottomIndex[0] = this.currentImgIndex+1;
            stitchList = [this.currentImg, this.imagesList[this.currentImgIndex+1]];
            break;
          case "bottom-to-top":
            topIndex[0] = this.currentImgIndex+1;
            stitchList = [this.imagesList[this.currentImgIndex+1], this.currentImg];
            break;
          default:
            break;
          }
        }
      } else if (this.viewingHint === 'continuous') {
        // TODO: stitch all images together per the viewingDirection
      } else {
        // undefined viewingHint, don't do anything
      }

      //set the focusImages for highlighting in panels
      jQuery.each(stitchList, function(index, image) {
        _this.focusImages.push(image['@id']);
      });
      _this.eventEmitter.publish('UPDATE_FOCUS_IMAGES.' + this.windowId, {array: this.focusImages});
      return stitchList;
    }
  };

}(Mirador));
