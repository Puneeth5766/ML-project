import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import os from "os";

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();

    // 🔥 FIX: ensure File[]
    const files = data.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const tempDir = path.join(os.tmpdir(), "secure-app-uploads");
    await mkdir(tempDir, { recursive: true });

    // 🔥 create a folder for this upload
    const rootFolder = path.join(tempDir, "upload_" + Date.now());
    await mkdir(rootFolder, { recursive: true });

    for (const file of files) {

      // 🔥 EXTRA SAFETY
      if (!(file instanceof File)) continue;

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      //@ts-ignore
      const relativePath = file.webkitRelativePath || file.name;

      const safePath = relativePath.replace(/[^a-zA-Z0-9/.\-_]/g, "_");

      const filePath = path.join(rootFolder, safePath);

      await mkdir(path.dirname(filePath), { recursive: true });

      await writeFile(filePath, buffer);
    }

    return NextResponse.json({ rootPath: rootFolder });

  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Upload failed: " + error.message }, { status: 500 });
  }
}
