import type { Metadata } from "next";
import { NewReportForm } from "./NewReportForm";
import { AE_LIST } from "@/lib/auth";

export const metadata: Metadata = { title: "New report" };

export default function NewReportPage() {
  return (
    <>
      <div className="topbar">
        <h1 className="h1">New report<small>Paste the intake details. Everything else is researched.</small></h1>
      </div>
      <NewReportForm aeList={AE_LIST.filter((n) => n !== "Dulmini Dodawatte").concat("Dulmini Dodawatte")} />
    </>
  );
}
