'use client'

export function PrintStyles() {
  return (
    <style jsx global>{`
      @media print {
        @page { margin: 0; size: auto; }
        body { background: white; }
        .print\\:hidden { display: none !important; }
        .print\\:shadow-none { box-shadow: none !important; }
        .print\\:p-0 { padding: 20mm !important; }
      }
    `}</style>
  )
}