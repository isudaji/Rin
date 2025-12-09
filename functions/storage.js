export async function onRequestPost(context) {
  try {
    const formData = await context.request.formData();
    const file = formData.get("file");

    if (!file) {
      return new Response(JSON.stringify({ error: "未找到文件" }), {
        status: 400,
      });
    }

    const filename =
      Date.now() + "-" + Math.random().toString(36).slice(2) + "-" + file.name;

    // 读取 R2 Bucket
    const bucket = context.env.R2;

    await bucket.put(filename, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const publicUrl = `${context.env.S3_PUBLIC_URL}/${filename}`;

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
    });
  }
}
