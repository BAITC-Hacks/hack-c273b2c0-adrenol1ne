// Next.js transport adapter. All routing, validation and business work lives in backend.
import { handleApi } from "@backend/api/router";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const GET = handleApi;
export const POST = handleApi;
