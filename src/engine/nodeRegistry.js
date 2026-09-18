const triggerNode =
  require("./nodes/triggerNode");

  const promptGeneratorNode = require("./nodes/promptGeneratorNode");
const imageGeneratorNode = require("./nodes/imageGeneratorNode");
const captionHashtagNode = require("./nodes/captionHashtagNode");

const codeNode =
  require("./nodes/codeNode");

const httpRequestNode =
  require("./nodes/httpRequestNode");

const editFieldsNode =
  require("./nodes/editFieldsNode");

const telegramNode =
  require("./nodes/telegramNode");

const instagramNode =
  require("./nodes/instagramNode");

const cloudinaryNode =
  require("./nodes/cloudinaryNode");

const nodeRegistry = {
  trigger:
    triggerNode,

    promptGenerator: promptGeneratorNode,
    imageGenerator: imageGeneratorNode,
    captionHashtag: captionHashtagNode,
  code:
    codeNode,

  httpRequest:
    httpRequestNode,

  editFields:
    editFieldsNode,

  telegram:
    telegramNode,

  instagram:
    instagramNode,

  cloudinary:
    cloudinaryNode,

    
};

const getNodeExecutor = (
  nodeType
) => {
  const executor =
    nodeRegistry[nodeType];

  if (!executor) {
    throw new Error(
      `Unsupported node type: ${nodeType}`
    );
  }

  return executor;
};

module.exports = {
  nodeRegistry,
  getNodeExecutor,
};