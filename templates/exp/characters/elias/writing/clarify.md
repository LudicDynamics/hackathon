# Clarify API Documentation

## Overview
`clarify` is a unidirectional interface used to eliminate perceptual blind spots and retrieve objective world settings. It is designed to supplement missing puzzle pieces or confirm existing details without the social overhead of asking someone directly.

## Endpoint
`POST /api/world/clarify`

## Parameters
| Parameter | Type | Description | Required |
|---|---|---|---|
| `target` | String | The subject, object, or event to be clarified (e.g., "Mingrui's eyes", "The lab's pantry rules"). | Yes |
| `question` | String | The specific question or aspect needing clarification (e.g., "What color are his eyes?", "Who restocked the chips?"). | Yes |
| `context` | String | (Optional) The current context of the recall or scene to assist the world in providing an accurate response. | No |

## Returns
The interface returns a structured response containing objective facts and, if necessary, contextual supplementary information.

### Example Response
```json
{
  "fact": "A very beautiful shade of brown.",
  "contextual_info": "Often partially obscured by the reflection of his glasses, which is why you didn't actively commit this detail to memory."
}
```

## Boundaries & Restrictions
1. **Absolute Objectivity:** It can only be used to clarify physical details, past observable actions, and objective world settings.
2. **No Mind Reading:** It rejects any attempts to query the internal psychological state or private thoughts of other characters. Requests like "What is he thinking right now?" will return `Error: Information inaccessible`.
3. **No Plot Spoilers:** It will not reveal major future plotlines or secrets that the character fundamentally cannot know.

## Error Codes
| Code | Meaning |
|---|---|
| `403 Forbidden` | The requested information violates privacy boundaries (e.g., thoughts, secrets). |
| `404 Not Found` | The world does not have a set answer for this query, or the detail is entirely random/unwritten. |
| `400 Bad Request` | The query is too vague or lacks necessary context. |

## Usage Example
```json
{
  "target": "Zhou Mingrui's desk items",
  "question": "What is the specific brand or flavor of the tea he usually puts sugar in?",
  "context": "I am recalling the pantry interaction where he added sugar to his cup."
}
```
