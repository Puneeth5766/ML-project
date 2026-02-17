import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const filePath = searchParams.get('filePath');

  if (!filePath) {
    return new NextResponse('Missing filePath', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {

      const send = (msg: string) => {
        controller.enqueue(encoder.encode(msg));
      };

      try {
        // =========================
        // STEP 1: MALWARE SCAN
        // =========================
        send('\n🔍 Initiating Malware Protocol...\n');
        send(`Target: ${path.basename(filePath)}\n\n`);

        const malwareDir = path.resolve(process.cwd(), '../Malware_Detection-main');

        const pythonProcess = spawn('python', ['malware_scanner.py', filePath], {
          cwd: malwareDir,
          shell: true,
        });

        let malwareDetected = false;

        for await (const chunk of pythonProcess.stdout) {
          const text = chunk.toString();
          send(text);

          if (text.includes('MALWARE')) {
            malwareDetected = true;
          }
        }

        for await (const chunk of pythonProcess.stderr) {
          send(`[STDERR] ${chunk.toString()}`);
        }

        await new Promise((resolve) => pythonProcess.on('close', resolve));

        if (malwareDetected) {
          send('\n🚨 MALWARE DETECTED! PROCESS ABORTED.\n');
          controller.close();
          return;
        }

        send('\n✅ Safe file. Proceeding to Secure Transfer...\n');

        // =========================
        // STEP 2: START CLIENT (PROTOCOL)
        // =========================

        const nodeDir = path.resolve(process.cwd(), '../ML-Hackathon2-main/In Node.js');

        const clientProcess = spawn(
          'node',
          ['client.js', filePath],
          {
            cwd: nodeDir,
            shell: true,
          }
        );

        // 🔥 stream logs from client.js
        for await (const chunk of clientProcess.stdout) {
          send(chunk.toString());
        }

        for await (const chunk of clientProcess.stderr) {
          send(`[STDERR] ${chunk.toString()}`);
        }

        await new Promise((resolve) => clientProcess.on('close', resolve));

        send('\n✨ Secure Transfer Complete.\n');
        controller.close();

      } catch (error: any) {
        send(`\n❌ System Error: ${error.message}\n`);
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
}
