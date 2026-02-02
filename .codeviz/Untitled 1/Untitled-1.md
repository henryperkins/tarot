# Unnamed CodeViz Diagram

```mermaid
graph TD

    cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_router_api_handlers["**API Route Handlers**<br>src/worker/index.js `import * as tarotReading from '../../functions/api/tarot-reading.js';`, src/worker/index.js `const routes = [`"]
    cloudflare_worker_reading_job_do_components.cv::postgresql_db_instance["**PostgreSQL Instance**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
    subgraph cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_state_manager["**Job State Manager**<br>src/worker/readingJob.js `this.job = { ... }`, src/worker/readingJob.js `persistState()`, src/worker/readingJob.js `expireIfNeeded()`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_sse_stream_manager["**SSE Stream Manager**<br>src/worker/readingJob.js `handleStream(request, url)`, src/worker/readingJob.js `subscribers = new Set()`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"]
        %% Edges at this level (grouped by source)
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"] -->|"Checks/Updates Job State"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_state_manager["**Job State Manager**<br>src/worker/readingJob.js `this.job = { ... }`, src/worker/readingJob.js `persistState()`, src/worker/readingJob.js `expireIfNeeded()`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"] -->|"Initiates Job Run"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"] -->|"Handles Stream Request"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_sse_stream_manager["**SSE Stream Manager**<br>src/worker/readingJob.js `handleStream(request, url)`, src/worker/readingJob.js `subscribers = new Set()`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"] -->|"Updates Job State (via appendEvent)"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_state_manager["**Job State Manager**<br>src/worker/readingJob.js `this.job = { ... }`, src/worker/readingJob.js `persistState()`, src/worker/readingJob.js `expireIfNeeded()`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"] -->|"Emits Events (via appendEvent)"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_sse_stream_manager["**SSE Stream Manager**<br>src/worker/readingJob.js `handleStream(request, url)`, src/worker/readingJob.js `subscribers = new Set()`"]
        cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_sse_stream_manager["**SSE Stream Manager**<br>src/worker/readingJob.js `handleStream(request, url)`, src/worker/readingJob.js `subscribers = new Set()`"] -->|"Retrieves Job State/Events for Backlog"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_state_manager["**Job State Manager**<br>src/worker/readingJob.js `this.job = { ... }`, src/worker/readingJob.js `persistState()`, src/worker/readingJob.js `expireIfNeeded()`"]
    end
    %% Edges at this level (grouped by source)
    cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Manages (start, status, cancel, stream)"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"]
    cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_state_manager["**Job State Manager**<br>src/worker/readingJob.js `this.job = { ... }`, src/worker/readingJob.js `persistState()`, src/worker/readingJob.js `expireIfNeeded()`"] -->|"Persists job data"| cloudflare_worker_reading_job_do_components.cv::postgresql_db_instance["**PostgreSQL Instance**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
    cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"] -->|"Calls Tarot Reading API"| cloudflare_worker_reading_job_do_components.cv::cloudflare_worker_router_api_handlers["**API Route Handlers**<br>src/worker/index.js `import * as tarotReading from '../../functions/api/tarot-reading.js';`, src/worker/index.js `const routes = [`"]

```
# Unnamed CodeViz Diagram

```mermaid
graph TD

    cloudflare_worker_router_components.cv::end_user["**End User**<br>src/main.jsx `ReactDOM.createRoot`"]
    cloudflare_worker_router_components.cv::frontend_web_app_reading_context["**Reading Context**<br>src/main.jsx `ReadingProvider`, src/contexts/ReadingContext.jsx `function ReadingProvider`"]
    cloudflare_worker_router_components.cv::frontend_web_app_auth_context["**Authentication Context**<br>src/main.jsx `AuthProvider`, src/contexts/AuthContext.jsx `function AuthProvider`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"]
    cloudflare_worker_router_components.cv::postgresql_db_instance["**PostgreSQL Instance**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
    cloudflare_worker_router_components.cv::azure_speech["**Azure Cognitive Services (Speech)**<br>package.json `microsoft-cognitiveservices-speech-sdk`"]
    cloudflare_worker_router_components.cv::openid_provider["**OpenID Connect Provider**<br>package.json `openid-client`, package.json `passport`"]
    cloudflare_worker_router_components.cv::s3_compatible_storage["**S3 Compatible Storage**<br>package.json `@aws-sdk/client-s3`"]
    subgraph cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router_main_handler["**Main Request Handler**<br>src/worker/index.js `async fetch(request, env, ctx)`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router_api_handlers["**API Route Handlers**<br>src/worker/index.js `import * as tarotReading from '../../functions/api/tarot-reading.js';`, src/worker/index.js `const routes = [`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router_scheduled_handler["**Scheduled Task Handler**<br>src/worker/index.js `async scheduled(controller, env, ctx)`, src/worker/index.js `import { handleScheduled } from '../../functions/lib/scheduled.js';`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router_og_injector["**Share Page OG Tag Injector**<br>src/worker/index.js `function buildShareOgMetaTags(token, shareRecord, entries, baseUrl)`, src/worker/index.js `async function handleSharePageWithOgTags(request, env, token)`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router_cors_handler["**CORS Handler**<br>src/worker/index.js `function handleOptions(request)`, src/worker/index.js `function addCorsHeaders(response, request)`"]
        %% Edges at this level (grouped by source)
        cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Delegates OPTIONS requests to"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Routes API requests to"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
        cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Handles /share page requests"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    end
    %% Edges at this level (grouped by source)
    cloudflare_worker_router_components.cv::end_user["**End User**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Accesses via HTTP"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    cloudflare_worker_router_components.cv::frontend_web_app_reading_context["**Reading Context**<br>src/main.jsx `ReadingProvider`, src/contexts/ReadingContext.jsx `function ReadingProvider`"] -->|"Makes API requests"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    cloudflare_worker_router_components.cv::frontend_web_app_auth_context["**Authentication Context**<br>src/main.jsx `AuthProvider`, src/contexts/AuthContext.jsx `function AuthProvider`"] -->|"Initiates Login via API"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Reads and writes data"| cloudflare_worker_router_components.cv::postgresql_db_instance["**PostgreSQL Instance**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Manages (start, status, cancel, stream) Durable Object"| cloudflare_worker_router_components.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Requests text-to-speech"| cloudflare_worker_router_components.cv::azure_speech["**Azure Cognitive Services (Speech)**<br>package.json `microsoft-cognitiveservices-speech-sdk`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Authenticates users"| cloudflare_worker_router_components.cv::openid_provider["**OpenID Connect Provider**<br>package.json `openid-client`, package.json `passport`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Stores and retrieves assets"| cloudflare_worker_router_components.cv::s3_compatible_storage["**S3 Compatible Storage**<br>package.json `@aws-sdk/client-s3`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"] -->|"Fetches OG image assets"| cloudflare_worker_router_components.cv::s3_compatible_storage["**S3 Compatible Storage**<br>package.json `@aws-sdk/client-s3`"]
    cloudflare_worker_router_components.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"] -->|"Calls Tarot Reading API"| cloudflare_worker_router_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]

```
# Unnamed CodeViz Diagram

```mermaid
graph TD

    base.cv::end_user["**End User**<br>[External]"]
    base.cv::neon_db["**Neon Database**<br>package.json `@neondatabase/serverless`"]
    base.cv::azure_speech["**Azure Cognitive Services (Speech)**<br>package.json `microsoft-cognitiveservices-speech-sdk`"]
    base.cv::logrocket["**LogRocket**<br>package.json `@logrocket/react-native`"]
    base.cv::openid_provider["**OpenID Connect Provider**<br>package.json `openid-client`, package.json `passport`"]
    base.cv::s3_compatible_storage["**S3 Compatible Storage**<br>package.json `@aws-sdk/client-s3`"]
    subgraph base.cv::tarot_system["**Tarot Application**<br>[External]"]
        subgraph base.cv::cloudflare_workers["**Cloudflare Workers**<br>package.json `"wrangler": "^4.59.1"`, wrangler.jsonc `name`"]
            subgraph base.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
                base.cv::cloudflare_worker_router_main_handler["**Main Request Handler**<br>src/worker/index.js `async fetch(request, env, ctx)`"]
                base.cv::cloudflare_worker_router_api_handlers["**API Route Handlers**<br>src/worker/index.js `import * as tarotReading from '../../functions/api/tarot-reading.js';`, src/worker/index.js `const routes = [`"]
                base.cv::cloudflare_worker_router_scheduled_handler["**Scheduled Task Handler**<br>src/worker/index.js `async scheduled(controller, env, ctx)`, src/worker/index.js `import { handleScheduled } from '../../functions/lib/scheduled.js';`"]
                base.cv::cloudflare_worker_router_og_injector["**Share Page OG Tag Injector**<br>src/worker/index.js `function buildShareOgMetaTags(token, shareRecord, entries, baseUrl)`, src/worker/index.js `async function handleSharePageWithOgTags(request, env, token)`"]
                base.cv::cloudflare_worker_router_cors_handler["**CORS Handler**<br>src/worker/index.js `function handleOptions(request)`, src/worker/index.js `function addCorsHeaders(response, request)`"]
            end
            subgraph base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
                base.cv::cloudflare_worker_reading_job_do_request_handler["**DO Request Handler**<br>src/worker/readingJob.js `async fetch(request)`, src/worker/readingJob.js `handleStart(request)`"]
                base.cv::cloudflare_worker_reading_job_do_state_manager["**Job State Manager**<br>src/worker/readingJob.js `this.job = { ... }`, src/worker/readingJob.js `persistState()`, src/worker/readingJob.js `expireIfNeeded()`"]
                base.cv::cloudflare_worker_reading_job_do_sse_stream_manager["**SSE Stream Manager**<br>src/worker/readingJob.js `handleStream(request, url)`, src/worker/readingJob.js `subscribers = new Set()`"]
                base.cv::cloudflare_worker_reading_job_do_reading_processor["**Tarot Reading Processor**<br>src/worker/readingJob.js `runJob(payload, authHeaders)`, src/worker/readingJob.js `consumeResponse(response)`"]
                %% Edges at this level (grouped by source)
                base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"] -->|"Checks/Updates Job State"| base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
                base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"] -->|"Initiates Job Run"| base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
                base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"] -->|"Handles Stream Request"| base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
                base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"] -->|"Updates Job State (via appendEvent)"| base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
                base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"] -->|"Emits Events (via appendEvent)"| base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
                base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"] -->|"Retrieves Job State/Events for Backlog"| base.cv::cloudflare_worker_reading_job_do["**Reading Job Durable Object**<br>wrangler.jsonc `class_name": "ReadingJob"`, src/worker/index.js `export { ReadingJob } from './readingJob.js';`, src/worker/readingJob.js `class ReadingJob`"]
            end
            subgraph base.cv::cloudflare_worker_scheduler["**Cloudflare Worker Scheduler**<br>wrangler.jsonc `triggers`, src/worker/index.js `async scheduled(controller, env, ctx)`"]
                base.cv::cloudflare_worker_scheduler_orchestrator["**Scheduled Task Orchestrator**<br>src/worker/index.js `handleScheduled`, src/worker/index.js `async scheduled(controller, env, ctx)`"]
                base.cv::cloudflare_worker_scheduler_metrics_archiver["**Metrics Archiver**<br>src/worker/index.js `adminArchive`, ../../functions/api/admin/archive.js"]
                base.cv::cloudflare_worker_scheduler_cleanup_service["**Cleanup Service**<br>[External]"]
                %% Edges at this level (grouped by source)
                base.cv::cloudflare_worker_scheduler["**Cloudflare Worker Scheduler**<br>wrangler.jsonc `triggers`, src/worker/index.js `async scheduled(controller, env, ctx)`"] -->|"Invokes"| base.cv::cloudflare_worker_scheduler["**Cloudflare Worker Scheduler**<br>wrangler.jsonc `triggers`, src/worker/index.js `async scheduled(controller, env, ctx)`"]
            end
        end
        subgraph base.cv::api_server["**API Server**<br>package.json `"express": "^5.2.1"`, server/index.ts `app.listen`"]
            subgraph base.cv::api_server_express["**Express API**<br>server/index.ts `app.listen`, package.json `"express": "^5.2.1"`"]
                base.cv::api_server_express_app_initializer["**Express App Initializer**<br>server/index.ts `const app = express()`, server/index.ts `app.use(express.json())`"]
                base.cv::api_server_express_authentication_module["**Authentication Module**<br>server/index.ts `setupAuth(app)`, server/index.ts `registerAuthRoutes(app)`, server/replit_integrations/auth.js"]
                base.cv::api_server_express_api_health_check_handler["**API Health Check Handler**<br>server/index.ts `app.get("/api/health")`"]
                base.cv::api_server_express_static_asset_server["**Static Asset Server**<br>server/index.ts `app.use(express.static(distPath))`"]
                base.cv::api_server_express_frontend_fallback_router["**Frontend Fallback Router**<br>server/index.ts `if (!req.path.startsWith("/api"))`, server/index.ts `res.sendFile(path.join(distPath, "index.html"))`"]
                base.cv::api_server_express_server_listener["**Server Listener**<br>server/index.ts `app.listen(PORT)`"]
                %% Edges at this level (grouped by source)
                base.cv::api_server_express["**Express API**<br>server/index.ts `app.listen`, package.json `"express": "^5.2.1"`"] -->|"Registers with Express app"| base.cv::api_server_express["**Express API**<br>server/index.ts `app.listen`, package.json `"express": "^5.2.1"`"]
                base.cv::api_server_express["**Express API**<br>server/index.ts `app.listen`, package.json `"express": "^5.2.1"`"] -->|"Starts Express app"| base.cv::api_server_express["**Express API**<br>server/index.ts `app.listen`, package.json `"express": "^5.2.1"`"]
            end
        end
        subgraph base.cv::frontend["**Frontend Application**<br>package.json `"react": "^19.0.0"`, package.json `"vite": "^7.2.4"`, vite.config.js `plugins: [react()]`"]
            subgraph base.cv::frontend_web_app["**Frontend Web Application**<br>package.json `"dev:frontend": "vite"`, package.json `"build": "vite build"`, src/main.jsx `ReactDOM.createRoot`"]
                base.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"]
                base.cv::frontend_web_app_routing_manager["**Routing Manager**<br>src/main.jsx `BrowserRouter`, src/main.jsx `AnimatedRoutes`, package.json `"react-router-dom"`"]
                base.cv::frontend_web_app_auth_context["**Authentication Context**<br>src/main.jsx `AuthProvider`, src/contexts/AuthContext.jsx `function AuthProvider`"]
                base.cv::frontend_web_app_subscription_context["**Subscription Context**<br>src/main.jsx `SubscriptionProvider`, src/contexts/SubscriptionContext.jsx `function SubscriptionProvider`"]
                base.cv::frontend_web_app_preferences_context["**Preferences Context**<br>src/main.jsx `PreferencesProvider`, src/contexts/PreferencesContext.jsx `function PreferencesProvider`"]
                base.cv::frontend_web_app_reading_context["**Reading Context**<br>src/main.jsx `ReadingProvider`, src/contexts/ReadingContext.jsx `function ReadingProvider`"]
                base.cv::frontend_web_app_toast_context["**Toast Notification Context**<br>src/main.jsx `ToastProvider`, src/contexts/ToastContext.jsx `function ToastProvider`"]
                base.cv::frontend_web_app_core_ui_components["**Core UI Components**<br>src/main.jsx `SkipLink`, src/components/SkipLink.jsx, src/main.jsx `AnimatedRoutes`, src/components/AnimatedRoutes.jsx"]
                %% Edges at this level (grouped by source)
                base.cv::frontend_web_app["**Frontend Web Application**<br>package.json `"dev:frontend": "vite"`, package.json `"build": "vite build"`, src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| base.cv::frontend_web_app["**Frontend Web Application**<br>package.json `"dev:frontend": "vite"`, package.json `"build": "vite build"`, src/main.jsx `ReactDOM.createRoot`"]
                base.cv::frontend_web_app["**Frontend Web Application**<br>package.json `"dev:frontend": "vite"`, package.json `"build": "vite build"`, src/main.jsx `ReactDOM.createRoot`"] -->|"Renders"| base.cv::frontend_web_app["**Frontend Web Application**<br>package.json `"dev:frontend": "vite"`, package.json `"build": "vite build"`, src/main.jsx `ReactDOM.createRoot`"]
            end
        end
    end
    subgraph base.cv::postgresql_db["**PostgreSQL Database**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
        base.cv::postgresql_db_instance["**PostgreSQL Instance**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
    end
    %% Edges at this level (grouped by source)
    base.cv::api_server_express["**Express API**<br>server/index.ts `app.listen`, package.json `"express": "^5.2.1"`"] -->|"Reads and writes data (e.g., session, user data)"| base.cv::postgresql_db["**PostgreSQL Database**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"]
    base.cv::postgresql_db["**PostgreSQL Database**<br>package.json `"drizzle-orm": "^0.45.1"`, drizzle.config.ts `schema`, migrations `0001_initial_schema.sql`"] -->|"Is hosted by"| base.cv::neon_db["**Neon Database**<br>package.json `@neondatabase/serverless`"]

```
# Unnamed CodeViz Diagram

```mermaid
graph TD

    frontend_web_app_components.cv::end_user["**End User**<br>src/main.jsx `ReactDOM.createRoot`"]
    frontend_web_app_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    frontend_web_app_components.cv::logrocket["**LogRocket**<br>package.json `@logrocket/react-native`"]
    subgraph frontend_web_app_components.cv::frontend_web_app["**Frontend Web Application**<br>package.json `"dev:frontend": "vite"`, package.json `"build": "vite build"`, src/main.jsx `ReactDOM.createRoot`"]
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"]
        frontend_web_app_components.cv::frontend_web_app_routing_manager["**Routing Manager**<br>src/main.jsx `BrowserRouter`, src/main.jsx `AnimatedRoutes`, package.json `"react-router-dom"`"]
        frontend_web_app_components.cv::frontend_web_app_auth_context["**Authentication Context**<br>src/main.jsx `AuthProvider`, src/contexts/AuthContext.jsx `function AuthProvider`"]
        frontend_web_app_components.cv::frontend_web_app_subscription_context["**Subscription Context**<br>src/main.jsx `SubscriptionProvider`, src/contexts/SubscriptionContext.jsx `function SubscriptionProvider`"]
        frontend_web_app_components.cv::frontend_web_app_preferences_context["**Preferences Context**<br>src/main.jsx `PreferencesProvider`, src/contexts/PreferencesContext.jsx `function PreferencesProvider`"]
        frontend_web_app_components.cv::frontend_web_app_reading_context["**Reading Context**<br>src/main.jsx `ReadingProvider`, src/contexts/ReadingContext.jsx `function ReadingProvider`"]
        frontend_web_app_components.cv::frontend_web_app_toast_context["**Toast Notification Context**<br>src/main.jsx `ToastProvider`, src/contexts/ToastContext.jsx `function ToastProvider`"]
        frontend_web_app_components.cv::frontend_web_app_core_ui_components["**Core UI Components**<br>src/main.jsx `SkipLink`, src/components/SkipLink.jsx, src/main.jsx `AnimatedRoutes`, src/components/AnimatedRoutes.jsx"]
        frontend_web_app_components.cv::frontend_web_app_service_worker_registrar["**Service Worker Registrar**<br>src/main.jsx `if ('serviceWorker' in navigator)`, src/main.jsx `navigator.serviceWorker.register('/sw.js')`"]
        %% Edges at this level (grouped by source)
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| frontend_web_app_components.cv::frontend_web_app_auth_context["**Authentication Context**<br>src/main.jsx `AuthProvider`, src/contexts/AuthContext.jsx `function AuthProvider`"]
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| frontend_web_app_components.cv::frontend_web_app_subscription_context["**Subscription Context**<br>src/main.jsx `SubscriptionProvider`, src/contexts/SubscriptionContext.jsx `function SubscriptionProvider`"]
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| frontend_web_app_components.cv::frontend_web_app_preferences_context["**Preferences Context**<br>src/main.jsx `PreferencesProvider`, src/contexts/PreferencesContext.jsx `function PreferencesProvider`"]
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| frontend_web_app_components.cv::frontend_web_app_reading_context["**Reading Context**<br>src/main.jsx `ReadingProvider`, src/contexts/ReadingContext.jsx `function ReadingProvider`"]
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| frontend_web_app_components.cv::frontend_web_app_toast_context["**Toast Notification Context**<br>src/main.jsx `ToastProvider`, src/contexts/ToastContext.jsx `function ToastProvider`"]
        frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Orchestrates"| frontend_web_app_components.cv::frontend_web_app_routing_manager["**Routing Manager**<br>src/main.jsx `BrowserRouter`, src/main.jsx `AnimatedRoutes`, package.json `"react-router-dom"`"]
        frontend_web_app_components.cv::frontend_web_app_routing_manager["**Routing Manager**<br>src/main.jsx `BrowserRouter`, src/main.jsx `AnimatedRoutes`, package.json `"react-router-dom"`"] -->|"Renders"| frontend_web_app_components.cv::frontend_web_app_core_ui_components["**Core UI Components**<br>src/main.jsx `SkipLink`, src/components/SkipLink.jsx, src/main.jsx `AnimatedRoutes`, src/components/AnimatedRoutes.jsx"]
    end
    %% Edges at this level (grouped by source)
    frontend_web_app_components.cv::end_user["**End User**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Uses"| frontend_web_app_components.cv::frontend_web_app_routing_manager["**Routing Manager**<br>src/main.jsx `BrowserRouter`, src/main.jsx `AnimatedRoutes`, package.json `"react-router-dom"`"]
    frontend_web_app_components.cv::frontend_web_app_reading_context["**Reading Context**<br>src/main.jsx `ReadingProvider`, src/contexts/ReadingContext.jsx `function ReadingProvider`"] -->|"Makes API requests"| frontend_web_app_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]
    frontend_web_app_components.cv::frontend_web_app_entry_point["**Application Entry Point**<br>src/main.jsx `ReactDOM.createRoot`"] -->|"Sends logs and session data"| frontend_web_app_components.cv::logrocket["**LogRocket**<br>package.json `@logrocket/react-native`"]
    frontend_web_app_components.cv::frontend_web_app_auth_context["**Authentication Context**<br>src/main.jsx `AuthProvider`, src/contexts/AuthContext.jsx `function AuthProvider`"] -->|"Initiates Login via API"| frontend_web_app_components.cv::cloudflare_worker_router["**Cloudflare Worker Router**<br>wrangler.jsonc `main": "./src/worker/index.js"`, src/worker/index.js `async fetch(request, env, ctx)`"]

```
---
*Generated by [CodeViz.ai](https://codeviz.ai) on 2/2/2026, 12:54:25 AM*
