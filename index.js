const $ = jQuery = require('jquery');
require('jstree');
require('jquery-ui-dist/jquery-ui')
const nodePath = require('path');
const fs = require('fs');
var os = require('os');
var pty = require('node-pty');
const { windowsStore, electron } = require('process');
const { Console } = require('console');
var Terminal = require('xterm').Terminal;
let files = [];
let dataObj = {};
let loadfiles = [];

$(document).ready(async function () {

  const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
    env: process.env
  });


  const xterm = new Terminal();
  xterm.open(document.getElementById('terminal'));

  xterm.onData(data => ptyProcess.write(data));
  ptyProcess.on('data', function (data) {
    xterm.write(data);
  });

  let editor = await createEditor();

  let currPath = process.cwd();


// Tab Updates
  let tabs = $("#tabs").tabs();

  tabs.on("click", ".ui-tabs-tab", function (event) {

    $('.ui-tabs-tab').attr("aria-selected", false);
    if ($(window.event.srcElement).hasClass('span.ui-icon-close')) {
      return;
    }
    window.event = event;
    console.log("click");
    let innerText = (event.currentTarget.innerText).split("R")[0];
    innerText = innerText.slice(0, innerText.length - 1);
    let lastFilePath = dataObj[innerText];
    tabs.tabs("refresh");
    updateEditor(lastFilePath);
    event.stopPropagation();
  });

  tabs.on("click", "span.ui-icon-close", function (event) { // catch event in callback

    if (files.length == 1) {
      return;
    }

    let innerText = (event.currentTarget.parentNode.innerText).split("R")[0];
    innerText = innerText.slice(0, innerText.length - 1);
    delete dataObj[innerText];
    var index = files.indexOf(innerText); //getting index of file to remove
    files.splice(index, 1); // removing file 
    let lastFile = files[files.length - 1];
    let lastFilePath = dataObj[lastFile]; //getting path from object of all files
    var panelId = parseInt($(this).closest("li").remove().attr("aria-controls"));
    $("#" + panelId).remove();
    tabs.tabs("refresh");
    updateEditor(lastFilePath);
    event.stopPropagation(); //to stop bubbling

  })

  document.getElementById("saveImg").addEventListener("click", async function () {

    let fileToSave = document.getElementById("heading").innerText.split(" ")[0];

    if (fileToSave == "Visual") {
      return;
    }

    let data = await fs.promises.writeFile(dataObj[fileToSave], editor.getValue());

    console.log(data);
  });

  document.getElementById("addFile").addEventListener("click", async function () {

    $('#jstree').jstree('open_node', `${process.cwd()}`);



    document.getElementById("fname").style.display = "block";
    document.getElementById("submit").style.display = "block";
    document.getElementById("tabs").style.marginLeft = "0.6rem";

    document.getElementById("submit").onclick = async function () {

      let fileName = document.getElementById("fname").value;
      let filePath = nodePath.join(process.cwd(), fileName);

      await fs.open(`${filePath}`, 'w', function (err) {
        if (err) {
          console.log(err)
        } else {
          console.log("New directory successfully created.")
          openFile(filePath);
          editor.setValue('function x() { \n console.log("New File is Created!"); \n } ');

        }
      })
    };
  });


  let data = [];

  let baseobj = {
    id: currPath,
    parent: '#',
    text: getNameFrompath(currPath),
    icons: false
  }

  let rootChildren = getCurrentDirectories(currPath);
  data = data.concat(rootChildren);

  data.push(baseobj);

  $('#jstree').jstree({
    "core": {
      "check_callback": true,
      "data": data,
      "themes": {
          "icons": false
      }
  }
  }).on('open_node.jstree', function (e, data) {

    data.node.children.forEach(function (child) {

      let childDirectories = getCurrentDirectories(child);

      for (let i = 0; i < childDirectories.length; i++) {
        let grandChild = childDirectories[i];
        $('#jstree').jstree().create_node(child, grandChild, "last");
      }

    })

  }).on("select_node.jstree", async function (e, data) {

    if (fs.lstatSync(data.node.id).isDirectory()) {
      return;
    }

    await openFile(data.node.id);

    updateEditor(data.node.id);
  });

  function updateEditor(path) {

    if (fs.lstatSync(path).isDirectory()) {
      return;
    }
    let fileName = getNameFrompath(path);

    if (!files.includes(fileName)) {
      return;
    }

    document.getElementById("heading").innerText = fileName + " - " + "Visual Studio Code";

    let fileExtension = fileName.split('.')[1];

    if (fileExtension === 'js')
      fileExtension = 'javascript';

    let data = fs.readFileSync(path).toString();

    editor.setValue(data);
    monaco.editor.setModelLanguage(editor.getModel(), fileExtension);
  }

  async function openFile(path) {

    let fileName = await getNameFrompath(path);

    if (dataObj[`${fileName}`] != undefined || files.length == 8) {
      return;
    }

    dataObj[`${fileName}`] = path;
    files.push(fileName);
    let label = fileName;
    let id = fileName; 
    let tabTemplate = "<li><a href='#{href}'>#{label}</a> <span class='ui-icon ui-icon-close' role='presentation'>Remove Tab</span></li>";
    let li = $(tabTemplate.replace(/#\{href\}/g, "#" + id).replace(/#\{label\}/g, label));
    tabs.find(".ui-tabs-nav").append(li);
    tabs.append("<div id='" + id + "'></div>");
    tabs.tabs("refresh");

  }

})


function getNameFrompath(path) {
  return nodePath.basename(path);
}

function getCurrentDirectories(path) {

  if (fs.lstatSync(path).isFile()) {
    return [];
  }
  let files = fs.readdirSync(path); 
  let rv = [];
  for (let i = 0; i < files.length; i++) {
    let file = files[i];
    if (!loadfiles.includes(nodePath.join(path, file))) {
      rv.push({
        id: nodePath.join(path, file),
        parent: path,
        text: file
      })
      loadfiles.push(nodePath.join(path, file));
    }
  }
  return rv;
}

function createEditor() {

  return new Promise(function (resolve, reject) {
    let monacoLoader = require('./node_modules/monaco-editor/min/vs/loader.js');
    monacoLoader.require.config({ paths: { 'vs': './node_modules/monaco-editor/min/vs' } });
    monacoLoader.require(['vs/editor/editor.main'], function () {

      monaco.editor.defineTheme('myTheme', {
        "base": "vs-dark",
        "inherit": true,
        "rules": [
          {
            "background": "000000",
            "token": ""
          },
          {
            "foreground": "ffffff",
            "background": "434242",
            "token": "text"
          },
          {
            "foreground": "ffffff",
            "background": "000000",
            "token": "source"
          },
          {
            "foreground": "9933cc",
            "token": "comment"
          },
          {
            "foreground": "3387cc",
            "token": "constant"
          },
          {
            "foreground": "cc7833",
            "token": "keyword"
          },
          {
            "foreground": "d0d0ff",
            "token": "meta.preprocessor.c"
          },
          {
            "fontStyle": "italic",
            "token": "variable.parameter"
          },
          {
            "foreground": "ffffff",
            "background": "9b9b9b",
            "token": "source comment.block"
          },
          {
            "foreground": "66cc33",
            "token": "string"
          },
          {
            "foreground": "aaaaaa",
            "token": "string constant.character.escape"
          },
          {
            "foreground": "000000",
            "background": "cccc33",
            "token": "string.interpolated"
          },
          {
            "foreground": "cccc33",
            "token": "string.regexp"
          },
          {
            "foreground": "cccc33",
            "token": "string.literal"
          },
          {
            "foreground": "555555",
            "token": "string.interpolated constant.character.escape"
          },
          {
            "fontStyle": "underline",
            "token": "entity.name.type"
          },
          {
            "fontStyle": "italic underline",
            "token": "entity.other.inherited-class"
          },
          {
            "fontStyle": "underline",
            "token": "entity.name.tag"
          },
          {
            "foreground": "c83730",
            "token": "support.function"
          }
        ],
        "colors": {
          "editor.foreground": "#FFFFFF",
          "editor.background": "#000000",
          "editor.selectionBackground": "#73597EE0",
          "editor.lineHighlightBackground": "#333300",
          "editorCursor.foreground": "#FFFFFF",
          "editorWhitespace.foreground": "#404040"
        }
      });

      monaco.editor.setTheme('myTheme');

      var editor = monaco.editor.create(document.getElementById('editor'), {
        value: [
          'function x() {',
          '\tconsole.log("Hello world!");',
          '}'
        ].join('\n'),
        language: 'javascript',
      });
      resolve(editor);
    });
  })

}