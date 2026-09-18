const {
  resolveMappings
} = require("../../utils/dataMapper");

const {
  resolveCredential
} = require("../../services/credentialService");

const {
  resolveCharacter
} = require("../../services/characterService");


const execute = async ({ input, node }) => {

  const config = node.config || {};

  let credential = null;
  let character = null;


  // ========================================
  // CREDENTIAL
  // ========================================

  if (config.credentialId) {

    credential = await resolveCredential(
      config.credentialId
    );

  }


  // ========================================
  // CHARACTER
  // ========================================

  console.log(
    "HTTP NODE CHARACTER CONFIG:",
    {
      characterId:
        config.characterId,

      referenceEnabled:
        config.referenceEnabled,

      referenceMapping:
        config.referenceMapping
    }
  );


  if (
    config.characterId &&
    (
      config.referenceEnabled === true ||
      config.referenceEnabled === "true" ||
      config.referenceEnabled === "Enabled"
    )
  ) {

    character =
      await resolveCharacter(
        config.characterId
      );


    console.log(
      "CHARACTER RESOLVED:",
      {
        id:
          character?._id ||
          character?.id,

        name:
          character?.name,

        referenceImage:
          character?.referenceImage
      }
    );

  }


  // ========================================
  // METHOD
  // ========================================

  const method = (
    config.method || "GET"
  ).toUpperCase();


  // ========================================
  // URL
  // ========================================

  if (!config.url) {

    throw new Error(
      "HTTP Request node requires a valid URL"
    );

  }


  const requestUrl =
    resolveMappings(
      config.url,
      input
    );


  // ========================================
  // HEADERS
  // ========================================

  const headers =
    resolveMappings(
      config.headers || {},
      input
    );


  // ========================================
  // CREDENTIAL INJECTION
  // ========================================

  if (
    credential &&
    credential.data
  ) {

    const {
      value,
      placement,
      key,
      prefix
    } = credential.data;


    if (
      value &&
      placement === "header" &&
      key
    ) {

      headers[key] =
        prefix
          ? `${prefix} ${value}`
          : value;

    }


  }


  // ========================================
  // QUERY
  // ========================================

  const query =
    resolveMappings(
      config.query || {},
      input
    );


  if (
    credential &&
    credential.data &&
    credential.data.value &&
    credential.data.placement === "query" &&
    credential.data.key
  ) {

    query[
      credential.data.key
    ] =
      credential.data.value;

  }


  // ========================================
  // FINAL URL
  // ========================================

  let finalUrl =
    requestUrl;


  if (
    Object.keys(query).length > 0
  ) {

    const searchParams =
      new URLSearchParams();


    for (
      const [key, value]
      of Object.entries(query)
    ) {

      if (
        value !== undefined &&
        value !== null
      ) {

        searchParams.append(
          key,
          String(value)
        );

      }

    }


    const queryString =
      searchParams.toString();


    if (queryString) {

      finalUrl =
        finalUrl.includes("?")
          ? `${finalUrl}&${queryString}`
          : `${finalUrl}?${queryString}`;

    }

  }


  // ========================================
  // REQUEST OPTIONS
  // ========================================

  const options = {
    method,
    headers
  };


  // ========================================
  // REQUEST BODY
  // ========================================

  if (
    !["GET", "HEAD"].includes(method)
  ) {

    const bodyType =
      config.bodyType ||
      "json";


    let resolvedBody =
      config.body !== undefined
        ? resolveMappings(
            config.body,
            input
          )
        : input;


    // ======================================
    // JSON CHARACTER REFERENCE
    // ======================================

    if (
      character &&
      config.referenceMapping
    ) {

      const {
        type,
        path
      } =
        config.referenceMapping;


      if (
        type === "body" &&
        path
      ) {

        resolvedBody =
          {
            ...(resolvedBody || {})
          };


        const pathParts =
          path.split(".");


        let target =
          resolvedBody;


        for (
          let i = 0;
          i <
          pathParts.length - 1;
          i++
        ) {

          const key =
            pathParts[i];


          if (
            !target[key] ||
            typeof target[key] !== "object"
          ) {

            target[key] = {};

          }


          target =
            target[key];

        }


        target[
          pathParts[
            pathParts.length - 1
          ]
        ] =
          character
            ?.referenceImage
            ?.url;

      }

    }


    // ======================================
    // JSON
    // ======================================

    if (
      bodyType === "json"
    ) {

      headers["Content-Type"] =
        headers["Content-Type"] ||
        "application/json";


      options.body =
        JSON.stringify(
          resolvedBody
        );

    }


    // ======================================
    // TEXT
    // ======================================

    else if (
      bodyType === "text"
    ) {

      headers["Content-Type"] =
        headers["Content-Type"] ||
        "text/plain";


      options.body =
        String(
          resolvedBody ?? ""
        );

    }


    // ======================================
    // FORM URLENCODED
    // ======================================

    else if (
      bodyType === "form-urlencoded"
    ) {

      headers["Content-Type"] =
        headers["Content-Type"] ||
        "application/x-www-form-urlencoded";


      const formData =
        new URLSearchParams(
          resolvedBody || {}
        );


      options.body =
        formData.toString();

    }


    // ======================================
    // MULTIPART FORM DATA
    // ======================================

    else if (
      bodyType === "multipart"
    ) {

      const formData =
        new FormData();


      // ------------------------------------
      // IMPORTANT
      // ------------------------------------

      // Browser/fetch must generate
      // multipart boundary automatically.

      delete headers["Content-Type"];
      delete headers["content-type"];


      headers["Accept"] =
        headers["Accept"] ||
        headers["accept"] ||
        "application/json";


      // ------------------------------------
      // NORMAL BODY FIELDS
      // ------------------------------------

      if (
        resolvedBody &&
        typeof resolvedBody === "object"
      ) {

        for (
          const [key, value]
          of Object.entries(
            resolvedBody
          )
        ) {

          if (
            value === undefined ||
            value === null
          ) {

            continue;

          }


          // Don't accidentally send
          // an object as [object Object]

          if (
            typeof value === "object"
          ) {

            formData.append(
              key,
              JSON.stringify(value)
            );

          } else {

            formData.append(
              key,
              String(value)
            );

          }

        }

      }


      // ------------------------------------
      // CHARACTER REFERENCE IMAGE
      // ------------------------------------

    if (character && config.referenceMapping) {
  const type = config.referenceMapping.type;
  const path = config.referenceMapping.path || "image";

  if (type === "multipart") {
    const imageUrl = character?.referenceImage?.url;

    console.log("CHARACTER BEFORE IMAGE:", character);
    console.log("REFERENCE TYPE:", type);
    console.log("REFERENCE FIELD:", path);
    console.log("IMAGE URL:", imageUrl);

    if (!imageUrl) {
      throw new Error("Character reference image URL not found");
    }

    const imageResponse = await fetch(imageUrl);

    if (!imageResponse.ok) {
      throw new Error(
        `Failed to fetch character reference image: ${imageResponse.status}`
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();

    const contentType =
      imageResponse.headers.get("content-type") || "image/png";

    const blob = new Blob([imageBuffer], {
      type: contentType
    });

    console.log("REFERENCE CONTENT TYPE:", contentType);
    console.log("REFERENCE IMAGE SIZE:", imageBuffer.byteLength);

    formData.append(
      path,
      blob,
      "character-reference.png"
    );

    console.log("CHARACTER IMAGE APPENDED:", path);
    formData.append("mode", "image-to-image");
    formData.append("strength", "0.35");
  }
}


      // ------------------------------------
      // FINAL MULTIPART BODY
      // ------------------------------------
console.log("=== FINAL FORMDATA ===");

for (const [key, value] of formData.entries()) {
  console.log(
    "FORM FIELD:",
    key,
    value instanceof Blob
      ? `BLOB ${value.type} ${value.size} bytes`
      : value
  );
}

console.log("======================");
      options.body =
        formData;

    }


    // ======================================
    // UNSUPPORTED BODY TYPE
    // ======================================

    else {

      throw new Error(
        `Unsupported HTTP body type: ${bodyType}`
      );

    }

  }


  // ========================================
  // TIMEOUT
  // ========================================

  const timeout =
    Number(
      config.timeout ||
      120000
    );


  const controller =
    new AbortController();


  const timeoutId =
    setTimeout(
      () => {
        controller.abort();
      },
      timeout
    );


  options.signal =
    controller.signal;


  // ========================================
  // DEBUG REQUEST
  // ========================================

  console.log(
    "HTTP REQUEST:",
    {
      method,
      url: finalUrl,
      bodyType:
        config.bodyType,
      hasCharacter:
        !!character,
      referenceMapping:
        config.referenceMapping
    }
  );


  // ========================================
  // REQUEST
  // ========================================

  try {

    const response =
      await fetch(
        finalUrl,
        options
      );


    const contentType =
      response.headers.get(
        "content-type"
      ) || "";


    let responseData;


    // --------------------------------------
    // JSON RESPONSE
    // --------------------------------------

  if (contentType.includes("application/json")) {
  responseData = await response.json();

  // Stability AI generated image
  if (
    responseData &&
    typeof responseData.image === "string"
  ) {
    const fs = require("fs");
    const path = require("path");

    const generatedDir = path.join(
      process.cwd(),
      "generated"
    );

    // generated folder create
    if (!fs.existsSync(generatedDir)) {
      fs.mkdirSync(generatedDir, {
        recursive: true,
      });
    }

    const fileName = `image-${Date.now()}.png`;

    const filePath = path.join(
      generatedDir,
      fileName
    );

    // Base64 → PNG
    const imageBuffer = Buffer.from(
      responseData.image,
      "base64"
    );

    fs.writeFileSync(
      filePath,
      imageBuffer
    );

    console.log(
      "GENERATED IMAGE SAVED:",
      filePath
    );

    // Keep original response + file information
    responseData = {
      ...responseData,
      generatedFile: fileName,
      generatedPath: filePath,
      generatedUrl: `/generated/${fileName}`,
    };
  }
}


    // --------------------------------------
    // IMAGE RESPONSE
    // --------------------------------------

    else if (
      contentType.startsWith(
        "image/"
      )
    ) {

      const buffer =
        await response.arrayBuffer();


      responseData =
        {
          type:
            "binary",

          contentType,

          base64:
            Buffer
              .from(buffer)
              .toString(
                "base64"
              )
        };

    }


    // --------------------------------------
    // OTHER RESPONSE
    // --------------------------------------

    else {

      responseData =
        await response.text();

    }


    // ======================================
    // OUTPUT
    // ======================================

    const output =
      {
        status:
          response.status,

        statusText:
          response.statusText,

        headers:
          Object.fromEntries(
            response.headers.entries()
          ),

        data:
          responseData
      };


    // ======================================
    // HTTP ERROR
    // ======================================

    if (!response.ok) {

      console.error(
        "HTTP ERROR STATUS:",
        response.status
      );


      console.error(
        "HTTP ERROR RESPONSE:",
        JSON.stringify(
          responseData,
          null,
          2
        )
      );


      const error =
        new Error(
          `HTTP request failed with status ${response.status}`
        );


      error.status =
        response.status;


      error.response =
        output;


      throw error;

    }


    // ======================================
    // SUCCESS
    // ======================================

    console.log(
      "HTTP REQUEST SUCCESS:",
      response.status
    );


    return output;

  }


  catch (error) {

    if (
      error.name === "AbortError"
    ) {

      throw new Error(
        `HTTP request timed out after ${timeout}ms`
      );

    }


    throw error;

  }


  finally {

    clearTimeout(
      timeoutId
    );

  }

};


module.exports = {
  execute
};