import { createFileRoute } from "@tanstack/react-router";
import QrPage from "@/qr/QrPage";

export const Route = createFileRoute("/qr")({
  component: QrPage,
});
