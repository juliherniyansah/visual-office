# Meshy prompt presets (MVP-2 Blender lab)

Image model: nano-banana-2 (Meshy-hosted, user-confirmed at checkpoint 2a).
3D model for kit + character: meshy-t2.5 smart-topology (todos 10, 14).
Reference images below are STYLE REFERENCES for texturing only.
Image URLs are never stored: fetch fresh via `meshy_get_task_status(<task_id>)`, use the FIRST element of `image_urls`.

## STYLE_PRESET

```
STYLE_PRESET = "stylized mid-poly 3D game asset, clean hand-painted textures, sharp edges, no noise, no blur, pastel office palette (#FFF8F0 walls, #D9D4CB floor, #FFB74D orange and #4DB6AC teal accents, small #E53935 red details), soft daylight, white background, single object centered"
```

## Piece prompts

```
KIT_wall_1m   = "modular office wall panel 1 m wide 3.2 m tall 0.15 m thick, flat front and back, pastel cream, " + STYLE_PRESET
KIT_wall_door = "modular office wall panel 1 m wide 3.2 m tall with a closed orange wooden door and thin frame, " + STYLE_PRESET
KIT_floor_1m  = "square modular office floor tile 1 m by 1 m, 0.1 m thick, light grey stylized carpet texture, " + STYLE_PRESET
KIT_pillar    = "square structural pillar 0.3 m by 0.3 m, 3.2 m tall, cream, " + STYLE_PRESET
CHARACTER     = "friendly adult office worker, humanoid, realistic-stylized proportions, 1.7 m tall, T-pose, short hair, teal shirt, dark trousers, sneakers, expressive face with modeled eyes and mouth, " + STYLE_PRESET
```

## Style reference image calls

```
REF_KIT prompt  = "style sheet: " + STYLE_PRESET + ", showing a wall panel, a floor tile and a door side by side"   (text-to-image, 16:9)
REF_CHAR prompt = "only the office worker character in the same style, full body, T-pose, white background"          (image-to-image from REF_KIT, 1:1)
```

## Task ids

REF_KIT_TASK_ID=01a14b08-42ed-73ed-ac01-428d651660b7
REF_CHAR_TASK_ID=01a14b08-ffc1-73fd-b32a-88cb613bdd2e

Note: refs are style/palette only. REF_KIT door is teal leaf + orange frame, floor is terrazzo; REF_CHAR has light grey trousers + brown shoes. Piece prompts above stay authoritative for shape/material. Meshy keeps image URLs 3 days after task finish (until 2026-10-20T18:03Z / 18:04Z); after that use texture_prompt only and ledger note REF_URL_EXPIRED.
