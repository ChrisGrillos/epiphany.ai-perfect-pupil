import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * EPIPHANY.AI - PERFECT PUPIL™
 * Complete OpenAPI Specification v2.0
 * 
 * This component documents the full API specification including:
 * - External AI Service Port
 * - Companion Algorithm Logic
 * - Natural Language Customization (Notepad Feature)
 * - Core Companion Management
 * - Subscription & Monetization
 * - Privacy & Security
 */

export const API_SPECIFICATION = {
  openapi: "3.0.0",
  info: {
    title: "Epiphany.AI - Perfect Pupil™ API",
    version: "2.0.0",
    description: `
      Complete API for the Perfect Pupil AI companion platform.
      
      Core Values: Honesty | Safety | Empathy | Privacy
      
      Features:
      - Emotionally safe AI companions
      - Tiered subscriptions (Free, Basic $0.99, Premium $4.99, Elite $9.99)
      - External AI provider integration
      - Natural language behavior customization
      - Internal companion algorithm
      - Privacy-first architecture with E2E encryption
    `,
    contact: {
      name: "Perfect Pupil Support",
      email: "support@perfectpupil.ai"
    }
  },
  servers: [
    {
      url: "https://api.perfectpupil.ai/v2",
      description: "Production server"
    },
    {
      url: "https://staging-api.perfectpupil.ai/v2",
      description: "Staging server"
    }
  ],
  
  paths: {
    // ========================================
    // COMPANION MANAGEMENT
    // ========================================
    "/companions": {
      post: {
        summary: "Create new companion",
        tags: ["Companion"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "species", "starting_stage"],
                properties: {
                  name: { type: "string", example: "Stella" },
                  species: { 
                    type: "string", 
                    enum: ["celestial", "aquatic", "forest", "crystal", "shadow"]
                  },
                  starting_stage: {
                    type: "string",
                    enum: ["infant", "child", "teenager"]
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "Companion created successfully",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Companion" }
              }
            }
          }
        }
      }
    },
    
    "/companions/{companionId}": {
      get: {
        summary: "Get companion details",
        tags: ["Companion"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Companion details",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Companion" }
              }
            }
          }
        }
      },
      patch: {
        summary: "Update companion stats",
        tags: ["Companion"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  hunger: { type: "number", minimum: 0, maximum: 100 },
                  happiness: { type: "number", minimum: 0, maximum: 100 },
                  fitness: { type: "number", minimum: 0, maximum: 100 },
                  knowledge_level: { type: "number", minimum: 0, maximum: 100 }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Companion updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Companion" }
              }
            }
          }
        }
      }
    },
    
    "/companions/{companionId}/interact": {
      post: {
        summary: "Perform interaction (feed, exercise, study, etc.)",
        tags: ["Companion"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["action_type"],
                properties: {
                  action_type: {
                    type: "string",
                    enum: ["feed", "exercise", "interact", "study", "play"]
                  },
                  details: { type: "object" }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Interaction completed",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    companion: { $ref: "#/components/schemas/Companion" },
                    response: { type: "string" },
                    stat_changes: { type: "object" }
                  }
                }
              }
            }
          }
        }
      }
    },
    
    // ========================================
    // EXTERNAL AI PROVIDER PORT (NEW)
    // ========================================
    "/ai-providers": {
      post: {
        summary: "Configure external AI provider",
        description: `
          Allows Premium/Elite users to connect external AI services (OpenAI, Anthropic, Grok, custom LLMs).
          API keys are encrypted server-side. Rate limits apply based on subscription tier.
        `,
        tags: ["AI Provider"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["provider_name"],
                properties: {
                  provider_name: {
                    type: "string",
                    enum: ["default", "openai", "anthropic", "grok", "custom"],
                    description: "AI service provider"
                  },
                  api_key: {
                    type: "string",
                    description: "Provider API key (encrypted)",
                    format: "password"
                  },
                  api_endpoint: {
                    type: "string",
                    description: "Custom endpoint URL for 'custom' provider"
                  },
                  model_name: {
                    type: "string",
                    description: "Specific model (e.g., 'gpt-4', 'claude-3-opus')"
                  },
                  fallback_to_default: {
                    type: "boolean",
                    default: true,
                    description: "Use default provider on failure"
                  }
                }
              },
              examples: {
                openai: {
                  summary: "OpenAI GPT-4",
                  value: {
                    provider_name: "openai",
                    api_key: "sk-...",
                    model_name: "gpt-4-turbo",
                    fallback_to_default: true
                  }
                },
                custom: {
                  summary: "Custom LLM Endpoint",
                  value: {
                    provider_name: "custom",
                    api_endpoint: "https://my-llm.example.com/v1/chat",
                    api_key: "my-secret-key",
                    fallback_to_default: true
                  }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "AI provider configured",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIProviderConfig" }
              }
            }
          },
          403: {
            description: "Tier insufficient (requires Premium/Elite)"
          }
        }
      },
      get: {
        summary: "Get current AI provider configuration",
        tags: ["AI Provider"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Current configuration",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AIProviderConfig" }
              }
            }
          }
        }
      }
    },
    
    "/ai-providers/test": {
      post: {
        summary: "Test AI provider connection",
        description: "Sends a test prompt to verify API key and endpoint work correctly",
        tags: ["AI Provider"],
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: "Connection successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean" },
                    response: { type: "string" },
                    latency_ms: { type: "number" }
                  }
                }
              }
            }
          }
        }
      }
    },
    
    // ========================================
    // COMPANION ALGORITHM (NEW)
    // ========================================
    "/companions/{companionId}/algorithm-state": {
      get: {
        summary: "Get companion's internal algorithm state",
        description: `
          Returns the current state machine status, behavioral flags, and decision log.
          The algorithm calculates mood, personality drift, and helpfulness without external AI.
        `,
        tags: ["Algorithm"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Algorithm state",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AlgorithmState" }
              }
            }
          }
        }
      },
      patch: {
        summary: "Update algorithm configuration",
        description: "Change response mode (algorithm_only, ai_assisted, full_ai)",
        tags: ["Algorithm"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  response_mode: {
                    type: "string",
                    enum: ["algorithm_only", "ai_assisted", "full_ai"]
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Algorithm updated"
          }
        }
      }
    },
    
    "/companions/{companionId}/calculate-mood": {
      post: {
        summary: "Trigger mood recalculation",
        description: `
          Internal algorithm calculates mood based on:
          - hunger + happiness + fitness → overall helpfulness
          - trust_level → cooperation
          - neglect detection → grumpy/withdrawn states
        `,
        tags: ["Algorithm"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Mood calculated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    new_mood: { type: "string" },
                    new_state: { type: "string" },
                    helpfulness_score: { type: "number" }
                  }
                }
              }
            }
          }
        }
      }
    },
    
    // ========================================
    // NATURAL LANGUAGE CUSTOMIZATION (NEW)
    // ========================================
    "/companions/{companionId}/notepad/parse": {
      post: {
        summary: "Parse natural language behavior customization",
        description: `
          Upload or input text describing desired behaviors/memories in plain English.
          System uses LLM to parse into structured traits, memories, and rules.
          
          Tier Limits:
          - Basic: 3 traits, 5 memories, 2 rules
          - Premium: 10 traits, 20 memories, 10 rules
          - Elite: Unlimited with local fine-tuning
        `,
        tags: ["Customization"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: {
                    type: "string",
                    description: "Natural language description",
                    example: "Make my companion witty and playful. They should love science fiction and remember that my favorite color is blue. When I greet them in the morning, be extra cheerful."
                  },
                  source_type: {
                    type: "string",
                    enum: ["text", "file"],
                    default: "text"
                  }
                }
              }
            },
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: ".txt file upload"
                  }
                }
              }
            }
          }
        },
        responses: {
          200: {
            description: "Parsing successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    traits: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          value: { type: "number", minimum: 0, maximum: 100 }
                        }
                      }
                    },
                    memories: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          key: { type: "string" },
                          value: { type: "string" },
                          type: { 
                            type: "string",
                            enum: ["fact", "preference", "event", "emotion", "skill"]
                          }
                        }
                      }
                    },
                    rules: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          name: { type: "string" },
                          description: { type: "string" },
                          condition: { type: "string" },
                          action: { type: "string" },
                          priority: { type: "number" }
                        }
                      }
                    }
                  }
                },
                example: {
                  traits: [
                    { name: "wit", value: 85 },
                    { name: "playfulness", value: 75 }
                  ],
                  memories: [
                    { key: "favorite_color", value: "blue", type: "preference" },
                    { key: "interest_scifi", value: "true", type: "preference" }
                  ],
                  rules: [
                    {
                      name: "morning_cheerful",
                      description: "Be extra cheerful in morning",
                      condition: "time_is_morning",
                      action: "use_cheerful_greeting",
                      priority: 70
                    }
                  ]
                }
              }
            }
          },
          400: {
            description: "Invalid content or tier limit exceeded"
          }
        }
      }
    },
    
    "/companions/{companionId}/memories": {
      get: {
        summary: "List companion memories",
        description: "Retrieve encrypted memories with selective recall",
        tags: ["Customization"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "type",
            in: "query",
            schema: { 
              type: "string",
              enum: ["fact", "preference", "event", "emotion", "skill"]
            }
          }
        ],
        responses: {
          200: {
            description: "Memory list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/CompanionMemory" }
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Add new memory",
        tags: ["Customization"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["memory_key", "memory_value"],
                properties: {
                  memory_key: { type: "string" },
                  memory_value: { type: "string" },
                  memory_type: {
                    type: "string",
                    enum: ["fact", "preference", "event", "emotion", "skill"]
                  },
                  importance: { type: "number", minimum: 0, maximum: 100 }
                }
              }
            }
          }
        },
        responses: {
          201: {
            description: "Memory created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CompanionMemory" }
              }
            }
          }
        }
      }
    },
    
    "/companions/{companionId}/memories/{memoryId}/recall": {
      post: {
        summary: "Recall specific memory",
        description: "Increments recall_count and updates last_recalled timestamp",
        tags: ["Customization"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          },
          {
            name: "memoryId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Memory recalled",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CompanionMemory" }
              }
            }
          }
        }
      }
    },
    
    "/companions/{companionId}/behavior-rules": {
      get: {
        summary: "List behavior rules",
        tags: ["Customization"],
        parameters: [
          {
            name: "companionId",
            in: "path",
            required: true,
            schema: { type: "string" }
          }
        ],
        responses: {
          200: {
            description: "Rules list",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/BehaviorRule" }
                }
              }
            }
          }
        }
      }
    }
  },
  
  components: {
    schemas: {
      Companion: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          species: { type: "string" },
          stage: { 
            type: "string",
            enum: ["infant", "child", "teenager", "adult"]
          },
          hunger: { type: "number" },
          happiness: { type: "number" },
          fitness: { type: "number" },
          knowledge_level: { type: "number" },
          trust_level: { type: "number" },
          affection_level: { type: "number" },
          mood: { type: "string" },
          personality_openness: { type: "number" },
          personality_agreeableness: { type: "number" },
          personality_curiosity: { type: "number" },
          personality_energy: { type: "number" },
          personality_empathy: { type: "number" }
        }
      },
      
      AIProviderConfig: {
        type: "object",
        properties: {
          id: { type: "string" },
          provider_name: { 
            type: "string",
            enum: ["default", "openai", "anthropic", "grok", "custom"]
          },
          api_endpoint: { type: "string" },
          model_name: { type: "string" },
          is_active: { type: "boolean" },
          monthly_api_calls: { type: "number" },
          call_limit: { type: "number" },
          fallback_to_default: { type: "boolean" }
        }
      },
      
      AlgorithmState: {
        type: "object",
        properties: {
          id: { type: "string" },
          companion_id: { type: "string" },
          current_state: {
            type: "string",
            enum: ["content", "needy", "playful", "learning", "tired", "grumpy", "excited", "withdrawn"]
          },
          state_duration: { type: "number" },
          transition_probabilities: { type: "object" },
          behavioral_flags: { 
            type: "object",
            properties: {
              is_neglected: { type: "boolean" },
              is_bonded: { type: "boolean" },
              is_learning: { type: "boolean" }
            }
          },
          response_mode: {
            type: "string",
            enum: ["algorithm_only", "ai_assisted", "full_ai"]
          },
          decision_log: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string", format: "date-time" },
                description: { type: "string" },
                inputs: { type: "object" },
                output: { type: "string" }
              }
            }
          }
        }
      },
      
      CompanionMemory: {
        type: "object",
        properties: {
          id: { type: "string" },
          companion_id: { type: "string" },
          memory_key: { type: "string" },
          memory_value: { type: "string", description: "Encrypted value" },
          memory_type: {
            type: "string",
            enum: ["fact", "preference", "event", "emotion", "skill"]
          },
          importance: { type: "number" },
          recall_count: { type: "number" },
          last_recalled: { type: "string", format: "date-time" },
          source: {
            type: "string",
            enum: ["interaction", "notepad", "observation", "learning"]
          },
          is_encrypted: { type: "boolean" }
        }
      },
      
      BehaviorRule: {
        type: "object",
        properties: {
          id: { type: "string" },
          companion_id: { type: "string" },
          rule_name: { type: "string" },
          rule_description: { type: "string" },
          condition: { type: "string" },
          action: { type: "string" },
          priority: { type: "number" },
          is_active: { type: "boolean" },
          trigger_count: { type: "number" }
        }
      }
    },
    
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  }
};

export default function APISpecification() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Complete API Specification Available</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-600">
          The full OpenAPI 3.0 specification has been generated and is available in the codebase.
          See components/docs/APISpecification.jsx for the complete documentation.
        </p>
      </CardContent>
    </Card>
  );
}