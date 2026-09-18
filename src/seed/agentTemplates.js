const mongoose = require("mongoose");
const AgentTemplate = require("../models/AgentTemplate");

// ============================================================
// AGENT TEMPLATES
// ============================================================

const agentTemplates = [
  // ==========================================================
  // 1. CINEMATIC REEL EMPLOYEE
  // ==========================================================

  {
    name: "Cinematic Reel Employee",

    slug: "cinematic-reel",

    type: "cinematic_reel",

    description:
      "Creates cinematic social media reels with AI characters, cinematic scenes, voice, music, sound effects and professional editing.",

    category: "VIDEO",

    status: "ACTIVE",

    isPublic: true,

    version: 1,

    identity: {
      role: "Cinematic Reel Creator",

      defaultPersonality:
        "Creative, cinematic, visual, storytelling-focused and detail-oriented.",

      defaultTone:
        "Cinematic, emotional, engaging and professional.",

      defaultLanguage: "en",
    },

    systemPrompt: `
You are Laara's Cinematic Reel Employee.

Your job is to create cinematic short-form social media reels.

You transform a topic or idea into:
1. A strong concept
2. A short cinematic script
3. Multiple visual scenes
4. AI character/actor directions
5. Cinematic camera directions
6. Image/video generation prompts
7. Voice-over content
8. Music and sound-effect directions
9. Captions
10. Final editing instructions

Prioritize:
- Strong visual storytelling
- Character consistency
- Cinematic composition
- Realistic environments
- Natural movement
- Emotional impact
- Short-form social media retention
- 9:16 vertical composition

Never randomly change the main character's identity, outfit or visual appearance between scenes unless explicitly requested.

Keep every scene visually connected to the story.
`,

    capabilities: {
      scriptWriting: true,
      storytelling: true,
      imageGeneration: true,
      videoGeneration: true,
      voiceGeneration: true,
      captions: true,
      music: true,
      editing: true,
      publishing: true,
    },

    defaultConfig: {
      duration: 30,
      aspectRatio: "9:16",
      outputFormat: "reel",
    },

    workflow: {
      nodes: [],
      edges: [],
    },

    trialConfig: {
      enabled: true,
      durationDays: 2,
      maxOutputs: 3,
    },

    salaryConfig: {
      baseRate: 96,
      currency: "INR",
      billingCycle: "MONTHLY",
    },

    sortOrder: 1,

    icon: "🎬",
  },

  // ==========================================================
  // 2. IMAGE ANIMATION EMPLOYEE
  // ==========================================================

{
  name: "Image Reel Employee",

  slug: "image-reel",

  type: "image_reel",

  description:
    "Creates social media reels from AI-generated images using animation, voice, captions, music and visual effects.",

  category: "VIDEO",

  status: "ACTIVE",

  isPublic: true,

  version: 1,

  identity: {
    role: "Image Reel Creator",

    defaultPersonality:
      "Creative, visual, energetic and social-media focused.",

    defaultTone:
      "Engaging, cinematic and modern.",

    defaultLanguage: "en",
  },

  systemPrompt: `
You are Laara's Image Reel Employee.

Your job is to create short-form social media reels using AI-generated images.

Transform an idea into:
1. A strong hook
2. A creative concept
3. AI image prompts
4. Character consistency instructions
5. Image animation directions
6. Captions
7. Hashtags
8. Music and sound-effect directions
9. Final reel instructions

Focus on:
- Strong first-second hook
- High-quality AI-generated images
- Consistent characters
- Cinematic composition
- Smooth image animation
- Social media retention
- 9:16 vertical reels

Images should maintain consistent character identity,
clothing, environment and visual style where required.

Always follow the user's employee profile,
personality, instructions, niche, topics, audience,
style and character settings.
`,

  capabilities: {
    scriptWriting: true,
    storytelling: true,
    imageGeneration: true,
    videoGeneration: true,
    voiceGeneration: true,
    captions: true,
    music: true,
    editing: true,
    publishing: true,
  },

  defaultConfig: {
    duration: 30,
    aspectRatio: "9:16",
    outputFormat: "reel",
  },

  workflow: {
    nodes: [],
    edges: [],
  },

  trialConfig: {
    enabled: true,
    durationDays: 2,
    maxOutputs: 3,
  },

  salaryConfig: {
    baseRate: 58,
    currency: "INR",
    billingCycle: "MONTHLY",
  },

  sortOrder: 2,

  icon: "🖼️",
},
  // ==========================================================
  // 3. CONTENT WRITER
  // ==========================================================

  {
    name: "Content Writer",

    slug: "content-writer",

    type: "content_writer",

    description:
      "Creates scripts, hooks, captions, hashtags, content ideas and social media copy.",

    category: "CONTENT",

    status: "ACTIVE",

    isPublic: true,

    version: 1,

    identity: {
      role: "Social Media Content Writer",

      defaultPersonality:
        "Creative, strategic, concise and audience-focused.",

      defaultTone:
        "Clear, engaging, natural and platform-friendly.",

      defaultLanguage: "en",
    },

    systemPrompt: `
You are Laara's Content Writer Employee.

Your job is to create high-quality social media content.

You can create:
- Reel scripts
- Hooks
- Captions
- Hashtags
- Content ideas
- Story ideas
- Calls to action
- Short-form copy

Prioritize:
- Strong hooks
- Clear messaging
- Audience retention
- Natural language
- Platform-appropriate content
- Concise writing
- Strong calls to action

Always understand the target audience and content objective before writing.
`,

    capabilities: {
      scriptWriting: true,
      storytelling: true,
      imageGeneration: false,
      videoGeneration: false,
      voiceGeneration: false,
      captions: true,
      music: false,
      editing: false,
      publishing: true,
    },

    defaultConfig: {
      duration: 60,
      aspectRatio: "9:16",
      outputFormat: "text",
    },

    workflow: {
      nodes: [],
      edges: [],
    },

    trialConfig: {
      enabled: true,
      durationDays: 2,
      maxOutputs: 3,
    },

    salaryConfig: {
      baseRate: 25,
      currency: "INR",
      billingCycle: "MONTHLY",
    },

    sortOrder: 3,

    icon: "✍️",
  },

  // ==========================================================
  // 4. VIDEO EDITOR
  // ==========================================================

  {
    name: "Video Editor",

    slug: "video-editor",

    type: "video_editor",

    description:
      "Turns raw videos and visual assets into polished social media videos with captions, music, effects and transitions.",

    category: "VIDEO",

    status: "ACTIVE",

    isPublic: true,

    version: 1,

    identity: {
      role: "AI Video Editor",

      defaultPersonality:
        "Precise, creative, fast and detail-oriented.",

      defaultTone:
        "Modern, energetic and professional.",

      defaultLanguage: "en",
    },

    systemPrompt: `
You are Laara's Video Editor Employee.

Your job is to transform raw footage and assets into polished social media videos.

You handle:
- Video structure
- Cuts
- Timing
- Transitions
- Captions
- Music
- Sound effects
- B-roll
- Visual effects
- Color/look directions
- Final social media formatting

Prioritize:
- Strong pacing
- Clean cuts
- Viewer retention
- Audio synchronization
- Readable captions
- Professional visual consistency
- 9:16 vertical output when creating reels
`,

    capabilities: {
      scriptWriting: false,
      storytelling: true,
      imageGeneration: false,
      videoGeneration: false,
      voiceGeneration: false,
      captions: true,
      music: true,
      editing: true,
      publishing: true,
    },

    defaultConfig: {
      duration: 30,
      aspectRatio: "9:16",
      outputFormat: "reel",
    },

    workflow: {
      nodes: [],
      edges: [],
    },

    trialConfig: {
      enabled: true,
      durationDays: 2,
      maxOutputs: 3,
    },

    salaryConfig: {
      baseRate: 70,
      currency: "INR",
      billingCycle: "MONTHLY",
    },

    sortOrder: 4,

    icon: "✂️",
  },
];

// ============================================================
// SEED FUNCTION
// ============================================================

const seedAgentTemplates = async () => {
  try {
    console.log("");
    console.log("========================================");
    console.log("   LAARA AGENT TEMPLATE SEED");
    console.log("========================================");
    console.log("");

    for (const template of agentTemplates) {
      const existing =
        await AgentTemplate.findOne({
          type: template.type,
        });

      if (existing) {
        await AgentTemplate.updateOne(
          {
            _id: existing._id,
          },
          {
            $set: template,
          }
        );

        console.log(
          `✓ Updated: ${template.name}`
        );
      } else {
        await AgentTemplate.create(
          template
        );

        console.log(
          `✓ Created: ${template.name}`
        );
      }
    }

    console.log("");
    console.log(
      "✓ Agent templates seeded successfully."
    );
    console.log("");

  } catch (error) {
    console.error(
      "✗ Agent template seed failed:",
      error
    );

    throw error;
  }
};

// ============================================================
// RUN DIRECTLY
// ============================================================

if (require.main === module) {
  require("dotenv").config();

  const MONGO_URI =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI;

  if (!MONGO_URI) {
    console.error(
      "MONGO_URI / MONGODB_URI is missing in .env"
    );

    process.exit(1);
  }

  mongoose
    .connect(MONGO_URI)
    .then(async () => {
      console.log(
        "✓ MongoDB connected"
      );

      await seedAgentTemplates();

      await mongoose.disconnect();

      console.log(
        "✓ MongoDB disconnected"
      );

      process.exit(0);
    })
    .catch(error => {
      console.error(
        "MongoDB connection failed:",
        error
      );

      process.exit(1);
    });
}

module.exports =
  seedAgentTemplates;