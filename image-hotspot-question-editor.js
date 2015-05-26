/*global H5P, H5PEditor*/
H5PEditor.widgets.imageHotspotQuestion = H5PEditor.ImageHotspotQuestion = (function ($) {
  /** @constant {string} */
  var RECTANGLE = 'rectangle';
  /** @constant {string} */
  var CIRCLE = 'circle';

  /**
   * Initialize image hotspot question editor.
   *
   * @param {Object} parent
   * @param {Object} field
   * @param {Object} params
   * @param {function} setValue
   * @returns {ImageHotspotQuestionEditor} Class instance
   */
  function ImageHotspotQuestionEditor(parent, field, params, setValue) {

    // Set default params
    if (params === undefined) {
      params = {
        taskDescription: '',
        hotspot: [],
        noneSelectedFeedback: ''
      };
      setValue(field, params);
    }

    // Make question parameters accessible
    this.parent = parent;
    this.params = params;
    this.elements = [];
    this.buttonTypes = [CIRCLE, RECTANGLE];
    this.dialogOpen = false;

    // Semantics that will used to generate forms
    this.taskDescriptionSemantics = [H5P.cloneObject(field.fields[0], true)];
    this.noneSelectedFeedbackSemantics = [H5P.cloneObject(field.fields[2], true)];
    this.elementFields = H5P.cloneObject(field.fields[1].field.fields[0].fields, true);

    this.initQuestion();
  }

  /**
   * Initiate question, create html and activate editor functionality.
   */
  ImageHotspotQuestionEditor.prototype.initQuestion = function () {
    var self = this;

    // Locate image field
    this.findImage(function (imageField) {
      self.imageField = imageField;
    });

    // Make sure widget can pass readies (used when processing semantics)
    this.passReadies = true;
    this.parent.ready(function () {
      self.passReadies = false;
    });

    this.createEditor();
  };

  /**
   * Find image from semantics if it has been chosen.
   * @param {function} callback Callback function with image as parameter
   */
  ImageHotspotQuestionEditor.prototype.findImage = function (callback) {
    var self = this;

    this.parent.ready(function () {
      var imageField = H5PEditor.findField('backgroundImageSettings/backgroundImage', self.parent);

      if (!imageField) {
        throw H5PEditor.t('core', 'unknownFieldPath', {':path': imageField});
      }

      callback(imageField);
    });
  };

  /**
   * Used to append this widget to a wrapper.
   * @param {jQuery} $wrapper Container widget will be appended to.
   */
  ImageHotspotQuestionEditor.prototype.appendTo = function ($wrapper) {

    this.$editor.appendTo($wrapper);
  };

  /**
   * Attach editor.
   */
  ImageHotspotQuestionEditor.prototype.createEditor = function () {
    // TODO: Make translation of error message
    var html =
      '<div class="h5p-image-hotspot-question-editor">' +
      ' <div class="error-message">' + 'You have not selected an image.' + '</div>' +
      ' <div class="task-description"></div>' +
      ' <div class="gui-wrapper">' +
      '   <div class="image-hotspot-dnb-wrapper"></div>' +
      '   <div class="image-hotspot-gui"></div>' +
      ' </div>' +
      ' <div class="none-selected-feedback"></div>' +
      '</div>';


    this.$editor = $(html);
    this.$taskDescription = $('.task-description', this.$editor);
    this.$guiWrapper = $('.gui-wrapper', this.$editor);
    this.$gui = $('.image-hotspot-gui', this.$editor);
    this.$dnbWrapper = $('.image-hotspot-dnb-wrapper', this.$editor);
    this.$noneSelectedFeedback = $('.none-selected-feedback', this.$editor);


    this.createToolbar();
    this.createDialog();
    this.createHotspots();

    // Create semantics
    H5PEditor.processSemanticsChunk(this.taskDescriptionSemantics, this.params, this.$taskDescription, this);
    H5PEditor.processSemanticsChunk(this.noneSelectedFeedbackSemantics, this.params, this.$noneSelectedFeedback, this);
  };

  /**
   * Initialize dialog for editing hotspots
   */
  ImageHotspotQuestionEditor.prototype.createDialog = function () {
    var self = this;
    var dialog =
      '<div class="h5peditor-fluid-dialog">' +
      '  <div class="h5peditor-fd-inner"></div>' +
      '  <div class="h5peditor-fd-buttons">' +
      '    <button class="h5peditor-fd-button h5peditor-done">' + 'done' + '</button>' +
      '    <button class="h5peditor-fd-button h5peditor-remove">' + 'remove' + '</button>' +
      '  </div>' +
      '</div>';

    this.$dialog = $(dialog);
    $('.h5peditor-done', this.$dialog).click(function () {
      if (self.doneCallback() !== false) {
        self.hideDialog();
      }
      return false;
    });

    $('.h5peditor-remove', this.$dialog).click(function () {
      self.removeCallback();
      self.hideDialog();
    });

    this.$dialog.appendTo(this.$gui);
    this.$dialoginner = $('.h5peditor-fd-inner', this.$dialog);
    this.$dialog.addClass('hidden');
  };

  ImageHotspotQuestionEditor.prototype.createHotspots = function () {
    var self = this;

    // Add Elements
    this.params.hotspot.forEach(function (hotspot, index) {
      self.insertElement(index);
    });
  };

  /**
   * Creates the toolbar and enables attachment of hotspots.
   */
  ImageHotspotQuestionEditor.prototype.createToolbar = function () {
    // Create toolbar and attach it
    this.createDragToolbar(this.$dnbWrapper);

    // Enable resize of figures and event handling
    this.activateResizeFunctionality();
  };

  /**
   * Create toolbar with draggable figures, and drag functionality.
   * @param {jQuery} $wrapper Container for toolbar
   */
  ImageHotspotQuestionEditor.prototype.createDragToolbar = function ($wrapper) {
    var self = this;

    if (!!this.toolbar) {
      return;
    }

    // Activate toolbar, add buttons and attach it to $wrapper
    this.toolbar = new H5P.DragNBar(this.createButtons(), this.$gui);
    this.toolbar.attach($wrapper);

    // Add event handling
    this.toolbar.stopMovingCallback = function (x, y) {
      // Update params when the element is dropped.
      var id = self.toolbar.dnd.$element.data('id');
      var hotspotParams = self.params.hotspot[id];

      // Measure x and y in percentages
      hotspotParams.computedSettings.x = x;
      hotspotParams.computedSettings.y = y;
    };

    this.toolbar.dnd.releaseCallback = function () {
      if (self.toolbar.newElement) {
        var id = self.toolbar.dnd.$element.data('id');
        var hotspotParams = self.params.hotspot[id];

        // Make sure stop moving callback is run first to get final mouse positions.
        setTimeout(function () {

          // Close open dialog
          if (self.dialogOpen) {
            self.hideDialog();
          }

          self.editElement(self.elements[id], hotspotParams.computedSettings.x, hotspotParams.computedSettings.y);
          self.toolbar.newElement = false;
        }, 0);
      }
    };
  };

  /**
   * Activate resize functionality for figures created with the toolbar.
   */
  ImageHotspotQuestionEditor.prototype.activateResizeFunctionality = function () {
    var self = this;
    if (!!this.resizableElements) {
      return;
    }

    // Activate drag n resize
    this.resizableElements = new H5P.DragNResize(this.$gui);

    // Add event handling
    this.resizableElements.resizeCallback = function (width, height) {
      var id = self.resizableElements.$element.data('id');
      var hotspotParams = self.params.hotspot[id];

      var fontSize = parseInt(self.$gui.css('font-size'), 10);
      hotspotParams.computedSettings.width = (width * fontSize)  / (self.$gui.width() / 100);
      hotspotParams.computedSettings.height = (height * fontSize)  / (self.$gui.height() / 100);
    };
  };

  ImageHotspotQuestionEditor.prototype.createButtons = function () {
    var self = this;
    var buttonArray = [];

    this.buttonTypes.forEach(function (buttonFigure) {
      buttonArray.push(self.createHotspotButton(buttonFigure));
    });

    return buttonArray;
  };

  ImageHotspotQuestionEditor.prototype.createHotspotButton = function (figure) {
    var self = this;

    return {
      id: figure,
      title: 'Create ' + figure,
      createElement: function () {
        // Push default parameters
        self.params.hotspot.push({
          userSettings: {
            correct: false,
            feedbackText: ''
          },
          computedSettings: {
            x: '50%',
            y: '50%',
            width: '40px',
            height: '40px',
            figure: figure
          }
        });

        return self.insertElement(self.params.hotspot.length - 1);
      }
    };
  };

  /**
   * Insert element at given params index.
   *
   * @param {string} figure The type of hotspot figure that will be inserted
   * @param {int} index
   * @returns {jQuery} The element's DOM
   */
  ImageHotspotQuestionEditor.prototype.insertElement = function (index) {
    var self = this;

    var elementParams = this.params.hotspot[index];
    var element = this.generateForm(this.elementFields, elementParams.userSettings);

    element.$element = $('<div>', {
      'class': 'h5p-dq-element'
    }).addClass(elementParams.computedSettings.figure)
      .appendTo(this.$gui)
      .css({
        left: elementParams.computedSettings.x + '%',
        top: elementParams.computedSettings.y + '%',
        width: elementParams.computedSettings.width + '%',
        height: elementParams.computedSettings.height + '%'
      })
      .data('id', index)
      .dblclick(function (mouseEvent) {
        self.editElement(element, mouseEvent.offsetX, mouseEvent.offsetY);
      });

    // Make it possible to focus and move element
    this.toolbar.add(element.$element);

    // Make resize possible
    this.resizableElements.add(element.$element);

    this.elements[index] = element;
    return element.$element;
  };

  /**
   * Collect functions to execute once the tree is complete.
   *
   * @param {function} ready
   * @returns {undefined}
   */
  ImageHotspotQuestionEditor.prototype.ready = function (ready) {
    if (this.passReadies) {
      this.parent.ready(ready);
    } else {
      this.readies.push(ready);
    }
  };

  /**
   * Set callbacks and open dialog with the form for the given element.
   *
   * @param {Object} element
   * @returns {undefined}
   */
  ImageHotspotQuestionEditor.prototype.editElement = function (element, elementPosX, elementPosY) {
    var self = this;
    var id = element.$element.data('id');

    this.doneCallback = function () {
      // Validate form
      var valid = true;
      element.children.forEach(function (child) {
        if (child.validate() === false) {
          valid = false;
        }
      });

      return valid;
    };

    this.removeCallback = function () {
      // Remove element form
      H5PEditor.removeChildren(element.children);

      // Remove element
      element.$element.remove();
      self.elements.splice(id, 1);
      self.params.hotspot.splice(id, 1);

      // Change data index for "all" elements
      self.elements.forEach(function (element, index) {
        element.$element.data('id', index);
      });
    };

    this.showDialog(element.$form, element, elementPosX, elementPosY);
  };

  /**
   * Generate sub forms that's ready to use in the dialog.
   *
   * @param {Object} semantics
   * @param {Object} params
   * @returns {{$form: jQuery, children:}}
   */
  ImageHotspotQuestionEditor.prototype.generateForm = function (semantics, params) {
    var $form = $('<div></div>');
    H5PEditor.processSemanticsChunk(semantics, params, $form, this);
    var $lib = $form.children('.library:first');
    if ($lib.length !== 0) {
      $lib.children('label, select, .h5peditor-field-description').hide().end().children('.libwrap').css('margin-top', '0');
    }

    return {
      $form: $form,
      children: this.children
    };
  };

  /**
   * Open hotspot settings dialog.
   *
   * @param {jQuery} $form
   * @returns {undefined}
   */
  ImageHotspotQuestionEditor.prototype.showDialog = function ($form, element, dialogPosX, dialogPosY) {
    // Threshold for placing dialog on side of image
    var roomForDialog = this.$editor.width() - this.$guiWrapper.width();

    if (this.dialogOpen) {
      return;
    }

    this.dialogOpen = true;

    // Attach form
    this.$currentForm = $form;
    $form.appendTo(this.$dialoginner);

    // Measure dialog size
    var $tmp = this.$dialog.clone()
      .addClass('inside')
      .appendTo(this.$gui);
    var dialogWidth = $tmp.outerWidth(true);
    var dialogHeight = $tmp.outerHeight(true);
    $tmp.remove();

    // Place dialog on side, underneath or inside image
    if (roomForDialog >= dialogWidth + 20) {

      // Append dialog to gui wrapper
      this.$dialog.addClass('outside-side')
        .insertAfter(this.$guiWrapper);

    } else if (this.$gui.height() < (dialogHeight + 20)) {

      // Put dialog under picture if small height
      this.$dialog.addClass('outside-underneath')
        .insertAfter(this.$gui);

    } else {
      // Place dialog inside image, pos calculated from mouse click
      var xPos = dialogPosX;
      var yPos = dialogPosY;

      // Center dialog on mouse
      xPos -= dialogWidth / 2;
      yPos -= dialogHeight / 2;

      // Apply element offset
      xPos += element.$element.position().left;
      yPos += element.$element.position().top;

      // Edge cases
      if (dialogWidth >= this.$guiWrapper.width()) {
        this.$dialog.outerWidth(this.$guiWrapper.width());
        xPos = 0;
      } else if (xPos < 0) {
        xPos = 0;
      } else if (xPos + dialogWidth > this.$guiWrapper.width()) {
        xPos = this.$guiWrapper.width() - dialogWidth;
      }

      // Already checked if image is too small
      if (yPos < 0) {
        yPos = 0;
      } else if (yPos + dialogHeight > this.$gui.height()) {
        yPos = this.$gui.height() - dialogHeight;
      }

      // Position dialog inside image
      this.$dialog.css({
        left: xPos,
        top: yPos
      }).addClass('inside')
        .appendTo(this.$gui);
    }

    // Show dialog
    this.$dialog.removeClass('hidden');

    // Hide hotspot coordinates
    this.toolbar.$coordinates.hide();
  };

  /**
   * Close hotspot settings dialog.
   */
  ImageHotspotQuestionEditor.prototype.hideDialog = function () {
    this.$currentForm.detach();
    this.dialogOpen = false;
    this.$dialog.detach()
      .addClass('hidden')
      .removeClass('outside-side')
      .removeClass('outside-underneath')
      .removeClass('inside');
  };

  /**
   * Validate the current field, required widget function.
   *
   * @returns {Boolean}
   */
  ImageHotspotQuestionEditor.prototype.validate = function () {
    return true;
  };

  /**
   * Called when the tab we are on is set as active.
   */
  ImageHotspotQuestionEditor.prototype.setActive = function () {
    if (!!this.imageField.params) {
      // Remove error text
      this.$editor.removeClass('no-image');

      //Remove old picture
      if (this.$image) {
        this.$image.remove();
      }

      // Create editor content
      this.populateQuestion();

    } else {
      // Remove image and display error message
      if (this.$image) {
        this.$image.remove();
      }
      this.$editor.addClass('no-image');
    }
  };

  ImageHotspotQuestionEditor.prototype.populateQuestion = function () {
    // Add image
    this.$image = $('<img>', {
      'src': H5P.getPath(this.imageField.params.path, H5PEditor.contentId)
    }).appendTo(this.$gui);

    // Scale image down if it is too wide
    if (this.$image.get(0).naturalWidth > this.$editor.width()) {
      this.$image.width(this.$editor.width());
    }

    // Set imagewrapper height to image height, because of an issue with drag n resize's css 'top'
    this.$gui.height(this.$image.height());
  };

  return ImageHotspotQuestionEditor;
}(H5P.jQuery));
