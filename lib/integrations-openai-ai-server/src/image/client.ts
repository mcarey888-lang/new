import fs from "node:fs";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
  );
}

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" | "1536x1024" | "1024x1536" = "1024x1024",
  options: { transparent?: boolean; outputFormat?: "png" | "jpeg" } = {},
): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size: size as "1024x1024",  // cast: gpt-image-1 accepts all these; SDK type is conservative
    ...(options.transparent ? { background: "transparent" } : {}),
    ...(options.outputFormat ? { output_format: options.outputFormat } : {}),
  } as Parameters<typeof openai.images.generate>[0]);
  const base64 = response.data?.[0]?.b64_json ?? "";
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) throw new Error("OpenAI image generation returned an empty image");
  return buffer;
}

export async function editImages(
  imageFiles: Array<string | Buffer>,
  prompt: string,
  outputPath?: string,
  options: { size?: "1024x1024" | "1536x1024" | "1024x1536"; transparent?: boolean; mimeTypes?: string[] } = {},
): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file, index) =>
      toFile(typeof file === "string" ? fs.createReadStream(file) : file, typeof file === "string" ? file : `reference-${index}.${options.mimeTypes?.[index] === "image/jpeg" ? "jpg" : "png"}`, {
        type: options.mimeTypes?.[index] || (typeof file === "string" ? "image/png" : "image/png"),
      })
    )
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
    ...(options.size ? { size: options.size } : {}),
    ...(options.transparent ? { background: "transparent" } : {}),
  } as Parameters<typeof openai.images.edit>[0]);

  const imageBase64 = response.data?.[0]?.b64_json ?? "";
  const imageBytes = Buffer.from(imageBase64, "base64");
  if (imageBytes.length === 0) throw new Error("OpenAI image edit returned an empty image");

  if (outputPath) {
    fs.writeFileSync(outputPath, imageBytes);
  }

  return imageBytes;
}
