export default {
  async fetch(request, env) {
    if (request.url.endsWith('/cleanup')) {
      console.log("Starting cleanup...");
      try {
        let listed = await env.VIDS_BUCKET.list();
        let deletedCount = 0;
        let truncated = false;

        do {
          const keys = listed.objects.map(o => o.key);
          console.log(`Found ${keys.length} objects. Deleting...`);
          if (keys.length > 0) {
            await env.VIDS_BUCKET.delete(keys);
            deletedCount += keys.length;
            console.log(`Deleted ${deletedCount} objects so far.`);
          }
          truncated = listed.truncated;
          if (truncated) {
            console.log("Fetching next batch...");
            listed = await env.VIDS_BUCKET.list({ cursor: listed.cursor });
          }
        } while (truncated);
        
        console.log("Cleanup complete.");
        return new Response(`Deleted ${deletedCount} objects from vids bucket.`);
      } catch (e) {
        console.error("Error during cleanup:", e);
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }
    return new Response('Ready to cleanup. Send GET to /cleanup');
  }
};
