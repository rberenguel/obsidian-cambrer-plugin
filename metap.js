class MetaP {
  static KEY_UP = "ArrowUp";
  static KEY_DOWN = "ArrowDown";
  static KEY_ENTER = "Enter";
  static KEY_ESCAPE = "Escape";

  constructor(props = {}) {
    this._initializeProperties(props);
    this._createMetaPGlass();
    this._createMetaPModal();
    this._createSearchInputDisplay();
    this._createFormInputDisplay();
    this._createCommandListContainer();
    this._hideInputDisplays();
  }

  visible() {
    return this.metaPGlass.style.display === "block";
  }

  ignoreKeys() {
    this.ignoresKeys = true;
  }

  _initializeProperties(props) {
    // HTML Containers
    this.metaPGlass = null;
    this.metaPModal = null;
    this.searchInputDisplay = null;
    this.formInputDisplay = null;
    this.commandListContainer = null;
    this.ellipsisRow = null;
    // Properties used for searching / inputs
    this.searchText = "";
    this.selectedCommand = null;
    this._matchStartIndex = 0;
    this._currentIndex = -1;
    this.inputBuffer = "";
    this.focusedElementBeforeOpen = null;
    this.commandInputValues = new Map();
    this.commandRows = [];
    // Properties
    this.maxCommands = props.maxCommands ?? 3;
    this.maxCommandTitleLength = props.maxCommandTitleLength ?? 20;
    this.id = props.id ?? "metap-modal";
    this.ignoresKeys = false;
    // Other
    this.oldp = window.print;
    console.log(props)
  }

  _createMetaPGlass() {
    this.metaPGlass = document.createElement("DIV");
    this.metaPGlass.classList.add("metap-glass");
    this.metaPGlass.classList.add("glass");
    this.metaPGlass.style.display = "none";
    this.metaPGlass.id = this.id + "-glass";
    this.metaPGlass.addEventListener("click", (ev) => {
      if (ev.target.id != this.id + "-glass") {
        return;
      }
      this.toggle();
    });
  }

  _createMetaPModal() {
    this.metaPModal = document.createElement("DIV");
    this.metaPModal.classList.add("metap-modal");
    this.metaPModal.id = this.id;
    this.metaPGlass.appendChild(this.metaPModal);
  }

  _createSearchInputDisplay() {
    this.searchInputDisplay = document.createElement("DIV");
    this.searchInputDisplay.id = "metap-search-input";
    this.searchInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.searchInputDisplay);
  }

  _createFormInputDisplay() {
    this.formInputDisplay = document.createElement("DIV");
    this.formInputDisplay.id = "metap-form-input";
    this.formInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.formInputDisplay);
  }

  _createCommandListContainer() {
    this.commandListContainer = document.createElement("DIV");
    this.commandListContainer.id = "metap-command-list";
    this.metaPModal.appendChild(this.commandListContainer);
  }

  _hideInputDisplays() {
    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).forEach(
      (inp) => (inp.style.display = "none"),
    );
  }

  _setupCommandsAndFilters(commands, filters = {}) {
    this.blur = filters.blur ?? 3;
    this.sepia = filters.sepia ?? 0;
    this.commands = commands;
    this.generate();
  }

  bind(commands, filters = {}, metaPhandler = true) {
    window.print = null;
    document.body.appendChild(this.metaPGlass);
    this._setupCommandsAndFilters(commands, filters);
    if (metaPhandler) {
      const isMac =
        /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      document.addEventListener("keydown", (ev) => {
        const cmd = isMac ? ev.metaKey : ev.ctrlKey;
        if (ev.key === "p" && cmd) {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          this.metaP();
          return;
        }
      });
      document.addEventListener("keyup", (ev) => {
        const cmd = isMac ? ev.metaKey : ev.ctrlKey;
        if (ev.key === "p" && cmd) {
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
          this.metaP();
          return;
        }
      });
    }
    document.addEventListener("keyup", this.handler(this));
  }

  removeHandler() {
    document.removeEventListener("keyup", this.handler(this));
  }

  toggle() {
    if (this.metaPModal.style.display === "block") {
      this.metaPModal.style.display = "none";
      this.metaPGlass.style.display = "none";
      this.metaPGlass.style.backdropFilter = null;
      if (this.focusedElementBeforeOpen) {
        this.focusedElementBeforeOpen.focus();
        this.focusedElementBeforeOpen = null;
      }
      this._removeInputs();
    } else {
      this.focusedElementBeforeOpen = document.activeElement;
      this.metaPModal.style.display = "block";
      this.metaPGlass.style.display = "block";
      this.metaPGlass.style.backdropFilter = `blur(${this.blur}px) sepia(${this.sepia}%)`;
      this.updateDisplay();
    }
    this.resetState();
  }

  generate() {
    this.commandListContainer.innerHTML = "";
    this.commandRows = [];
    this.commands.forEach((d, index) => {
      const div = document.createElement("DIV");
      let commandTitle = d.title;
      if (d.title.split("\n").length > 1) {
        commandTitle = d.aliases ? d.aliases[0] : "[Multiline command]";
      }
      if (commandTitle.length > this.maxCommandTitleLength) {
        commandTitle =
          commandTitle.substring(0, this.maxCommandTitleLength) + "…";
      }
      div.innerText = commandTitle;
      div.title = d.title;

      div.classList.add("metap-modal-row");
      div.style.display = "none";

      div.lambda = d.lambda;
      div.updater = d.updater;
      div.inputs = d.inputs;
      div.command = d;
      div.aliases = d.aliases;
      div.dataset.index = index;
      if (d.disabled) {
        div.classList.add("disabled");
      } else {
        div.addEventListener("click", () => {
          //this.ignoresKeys = false;
          if (this._usingForm) {
            this._usingForm.dispatchEvent(new Event("submit"));
          } else {
            this.searchText = div.title;
            this.updateDisplay();
            this._handleEnter();
          }
        });
      }

      this.commandListContainer.appendChild(div);
      this.commandRows.push({
        command: d,
        div: div,
        isMatch: true,
        originalIndex: index,
      });
    });
  }

  metaP() {
    this._matchStartIndex = 0;
    this.updateDisplay();
    this.toggle();
  }

  _removeInputs() {
    this.formInputDisplay.innerHTML = "";
    this._usingForm = null;
  }

  selectCommand(command, div) {
    this._clearSearchInput();

    if (command.inputs && Array.isArray(command.inputs)) {
      Array.from(this.commandListContainer.querySelectorAll("DIV")).map((d) => {
        if (d != div) {
          d.style.display = "none";
        }
      });
      this._handleCommandWithInputs(command, div);
    } else {
      this._executeCommandWithoutInputs(command);
    }
  }

  _clearSearchInput() {
    this.searchInputDisplay.innerText = "";
    this.searchInputDisplay.style.display = "none";
  }

  _handleCommandWithInputs(command, div) {
    this.selectedCommand = command;
    this._prepareFormInputDisplay();
    const form = this._createInputForm(command);
    this._appendInputsToForm(form, command, div);
    this.formInputDisplay.appendChild(form);
    this._displayFormInputAndHideOthers();
  }

  _prepareFormInputDisplay() {
    this.formInputDisplay.innerHTML = "";
    this.formInputDisplay.style.display = "block";
  }

  _createInputForm(command) {
    const form = document.createElement("FORM");
    form.id = this.id + "-form";
    form.classList.add("metap-input-form");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleFormSubmit(form, command);
    });
    return form;
  }

  _appendInputsToForm(form, command, div) {
    const savedValues = this.commandInputValues.get(command);

    command.inputs.forEach((inputDef, index) => {
      const input = document.createElement("INPUT");
      input.type = "text";
      input.classList.add("metap-form-input");
      input.dataset.index = index;
      input.placeholder = inputDef.title;

      if (inputDef.default) {
        input.value = inputDef.default;
      } else if (savedValues && savedValues[index]) {
        input.value = savedValues[index];
      }

      input.addEventListener("keyup", (ev) =>
        this._handleInputKeyup(ev, form, command, div, index),
      );
      form.appendChild(input);
      if (index === 0) {
        setTimeout(() => input.focus(), 0);
      }
    });
    this._usingForm = form;
  }

  _handleInputKeyup(ev, form, command, div, index) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      this._focusNextInputOrSubmitForm(ev, form, command, index);
    } else {
      if (command.updater) {
        this._updateCommandTitleWithInput(form, command, div);
      }
    }
  }

  _focusNextInputOrSubmitForm(ev, form, command, index) {
    const nextIndex = index + 1;
    if (nextIndex < command.inputs.length) {
      const nextInput = form.querySelector(`input[data-index="${nextIndex}"]`);
      if (nextInput) {
        nextInput.focus();
      }
    } else {
      form.dispatchEvent(new Event("submit"));
    }
  }

  _updateCommandTitleWithInput(form, command, div) {
    const inputValues = Array.from(
      form.querySelectorAll(".metap-form-input"),
    ).map((input) => input.value);
    this.commandInputValues.set(command, inputValues);
    div.textContent = command.updater(...inputValues);
  }

  _displayFormInputAndHideOthers() {
    Array.from(this.metaPModal.querySelectorAll(".metap-inputs"))
      .filter((inp) => inp !== this.formInputDisplay)
      .forEach((inp) => (inp.style.display = "none"));
  }

  _executeCommandWithoutInputs(command) {
    this.toggle();
    command.lambda();
    // Lambda after toggle allows Lambda to control properties of metap
  }

  handleFormSubmit(form, command) {
    const inputValues = Array.from(
      form.querySelectorAll(".metap-form-input"),
    ).map((input) => input.value);
    this.commandInputValues.set(command, inputValues);
    command.lambda(...inputValues);
    this.toggle();
  }

  resetState() {
    this.selectedCommand = null;
    this.inputBuffer = "";
    this.searchText = "";
    this._currentIndex = -1;
    this._matchStartIndex = 0;

    this.formInputDisplay.innerHTML = "";
    this.formInputDisplay.style.display = "none";

    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
      (inp) => (inp.style.display = "none"),
    );
    this.updateDisplay();
  }

  updateDisplay() {
    this._updateSearchInputDisplay();
    this._updateCommandMatchStatus();
    this._filterAndSliceCommands();
    this._renderVisibleCommands();
    this._handleEllipsisDisplay();
    this._updateSelectionHighlight();
  }

  _updateSearchInputDisplay() {
    this.searchInputDisplay.innerText = this.searchText;
    this.searchInputDisplay.style.display = this.searchText ? "block" : "none";
  }

  _updateCommandMatchStatus() {
    this.commandRows.forEach((rowObj) => {
      const command = rowObj.command;
      if (!this.searchText) {
        rowObj.isMatch = true;
        return;
      }

      const titleMatch = command.title
        .toLowerCase()
        .includes(this.searchText.toLowerCase());
      let aliasMatch = false;
      if (command.aliases && Array.isArray(command.aliases)) {
        aliasMatch = command.aliases.some((alias) =>
          alias.toLowerCase().includes(this.searchText.toLowerCase()),
        );
      }
      rowObj.isMatch = titleMatch || aliasMatch;
    });
  }

  _filterAndSliceCommands() {
    let matches = this.commandRows.filter((rowObj) => rowObj.isMatch);

    this.candidateCommands = matches;

    this.matchesToDisplay = this.candidateCommands.slice(
      this._matchStartIndex,
      this._matchStartIndex + this.maxCommands,
    );
    this.allMatchingCommandsCount = this.candidateCommands.length;
  }
  _renderVisibleCommands() {
    this.commandRows.forEach((rowObj) => (rowObj.div.style.display = "none"));
    this.commandListContainer.innerHTML = "";

    this.matchesToDisplay.forEach((rowObj) => {
      rowObj.div.style.display = "block";
      this.commandListContainer.appendChild(rowObj.div);
    });
  }

  _handleEllipsisDisplay() {
    const displayedMatchCount = this.matchesToDisplay.length;

    if (
      (this.searchText &&
        this.allMatchingCommandsCount > displayedMatchCount) ||
      (!this.searchText && this.commands.length > this.maxCommands)
    ) {
      if (!this.ellipsisRow) {
        this.ellipsisRow = document.createElement("DIV");
        this.ellipsisRow.innerText = "...";
        this.ellipsisRow.classList.add("metap-modal-row", "metap-ellipsis-row");
        this.commandListContainer.appendChild(this.ellipsisRow);
      }
      this.ellipsisRow.style.display = "block";
    } else if (this.ellipsisRow) {
      this.ellipsisRow.style.display = "none";
    }
  }

  _updateSelectionHighlight() {
    const visibleRows = Array.from(
      this.commandListContainer.querySelectorAll(".metap-modal-row"),
    ).filter(
      (row) =>
        row.style.display === "block" &&
        !row.classList.contains("metap-ellipsis-row"),
    );

    if (visibleRows.length > 0) {
      if (this._currentIndex < 0) {
        this._currentIndex = 0;
      } else if (this._currentIndex >= visibleRows.length) {
        this._currentIndex = visibleRows.length - 1;
      }

      visibleRows.forEach((row, index) => {
        if (index === this._currentIndex) {
          row.classList.add("metap-modal-row-hovered");
        } else {
          row.classList.remove("metap-modal-row-hovered");
        }
      });
    } else {
      this._currentIndex = -1;
    }
  }

  handler(dis) {
    return function (ev) {
      if (dis === undefined) {
        console.log("who dis?");
        return;
      }
      if (dis.ignoresKeys) {
        console.info("Command ignored", ev.key, ev);
        return;
      }
      if (!dis._isMetaPModalOpen()) {
        return;
      }
      if (dis._isInputTyping(ev)) {
        return;
      }

      ev.preventDefault();
      ev.stopPropagation();

      switch (ev.key) {
        case "Backspace":
          dis._handleBackspace();
          dis.updateDisplay();
          break;
        case "Escape":
          dis._handleEscape();
          dis.updateDisplay();
          break;
        case "Enter":
          dis._handleEnter();
          break;
        case "ArrowDown":
          dis._handleArrowDown();
          dis.updateDisplay();
          break;
        case "ArrowUp":
          dis._handleArrowUp();
          dis.updateDisplay();
          break;
        default:
          if (ev.key.length === 1) {
            dis._handleSingleCharInput(ev.key);
            dis.updateDisplay();
          }
      }
    };
  }

  dismiss() {
    if (!this.visible()) {
      return;
    }
    this._handleEscape();
    this.updateDisplay();
  }
  accept() {
    if (!this.visible()) {
      return;
    }
    this.updateDisplay();
    this._handleEnter();
  }

  goDown() {
    if (!this.visible()) {
      return;
    }
    this._handleArrowDown();
    this.updateDisplay();
  }

  goUp() {
    if (!this.visible()) {
      return;
    }
    this._handleArrowUp();
    this.updateDisplay();
  }

  _isMetaPModalOpen() {
    return this.metaPModal.style.display === "block";
  }

  _isInputTyping(ev) {
    return (
      ev.target?.nodeName === "INPUT" &&
      ev.key !== "Escape" &&
      ev.target?.classList?.contains("metap-form-input")
    );
  }

  _handleBackspace() {
    this.searchText = this.searchText.slice(0, -1);
    this._currentIndex = -1;
    this._matchStartIndex = 0;
  }

  _handleEscape() {
    this._removeInputs();
    if (this.searchText !== "") {
      this.searchText = "";
      this._currentIndex = -1;
      this._matchStartIndex = 0;
    } else {
      this.toggle();
    }
  }

  _handleEnter() {
    const visibleRows = this._getVisibleCommandRows();
    if (this._isValidSelection(visibleRows)) {
      const selectedRow = visibleRows[this._currentIndex];
      const commandIndex = parseInt(selectedRow.dataset.index);
      const command = this.commands[commandIndex];
      this.selectCommand(command, selectedRow);
    } else {
      this.toggle();
    }
  }

  _getVisibleCommandRows() {
    return Array.from(
      this.commandListContainer.querySelectorAll(".metap-modal-row"),
    ).filter(
      (row) =>
        row.style.display === "block" &&
        !row.classList.contains("metap-ellipsis-row"),
    );
  }

  _isValidSelection(visibleRows) {
    return (
      visibleRows.length > 0 &&
      this._currentIndex >= 0 &&
      this._currentIndex < visibleRows.length
    );
  }

  _handleArrowDown() {
    this._currentIndex++;
    let visibleRows = this._getVisibleCommandRows();

    if (this._currentIndex >= visibleRows.length) {
      const allMatchesCount = this.commandRows.filter(
        (row) => row.isMatch,
      ).length;
      if (this._matchStartIndex + this.maxCommands < allMatchesCount) {
        this._matchStartIndex += 1;
        this.updateDisplay();
        this._currentIndex = this.maxCommands - 1;
      } else {
        this._currentIndex = visibleRows.length - 1;
      }
    }
  }

  _handleArrowUp() {
    this._currentIndex--;
    if (this._currentIndex < 0) {
      if (this._matchStartIndex > 0) {
        this._matchStartIndex -= 1;
        this.updateDisplay();
        this._currentIndex = 0;
      } else {
        this._currentIndex = 0;
      }
    }
  }

  _handleSingleCharInput(key) {
    this.searchText += key;
    this._currentIndex = -1;
    this._matchStartIndex = 0;
  }

  dispatchKeyEvent(key) {
    if (!this._isMetaPModalOpen()) {
      return;
    }

    const event = new KeyboardEvent("keyup", { key: key });

    this.handler(this)(event);
  }
}

const metaP = new MetaP();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { metaP, MetaP };
} else if (typeof define === "function" && define.amd) {
  define(function () {
    return metaP;
  });
} else {
  window.metaP = metaP;
  window.MetaP = MetaP;
}
