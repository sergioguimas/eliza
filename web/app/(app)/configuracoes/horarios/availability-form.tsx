"use client";

import { useState } from "react";
import { DayAvailability } from "@/lib/types";
import { updateProfessionalAvailability } from "@/app/actions/update-availability";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Clock, Coffee, CalendarDays } from "lucide-react";
import { Label } from "@/components/ui/label";

const DAYS = [
  { id: 0, label: "Dom" }, { id: 1, label: "Seg" }, { id: 2, label: "Ter" },
  { id: 3, label: "Qua" }, { id: 4, label: "Qui" }, { id: 5, label: "Sex" }, { id: 6, label: "Sáb" }
];

interface Props {
  professionalId: string;
  professionalName: string;
  initialData: any[];
}

export function AvailabilityForm({ professionalId, professionalName, initialData }: Props) {
  const [loading, setLoading] = useState(false);
  
  // Estado dos dias selecionados
  const [selectedDays, setSelectedDays] = useState<number[]>(() => 
    initialData.filter(d => d.is_active).map(d => d.day_of_week)
  );
  
  // Estados de Horário (Padrão para todos os dias selecionados)
  const [startTime, setStartTime] = useState(initialData[0]?.start_time?.slice(0, 5) || "08:00");
  const [endTime, setEndTime] = useState(initialData[0]?.end_time?.slice(0, 5) || "18:00");
  const [breakStart, setBreakStart] = useState(initialData[0]?.break_start?.slice(0, 5) || "12:00");
  const [breakEnd, setBreakEnd] = useState(initialData[0]?.break_end?.slice(0, 5) || "13:00");

  const toggleDay = (dayId: number) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(id => id !== dayId) : [...prev, dayId]
    );
  };

  async function onSubmit() {
    setLoading(true);
    
    const payload: DayAvailability[] = Array.from({ length: 7 }, (_, i) => ({
      professional_id: professionalId,
      day_of_week: i,
      start_time: startTime,
      end_time: endTime,
      break_start: breakStart,
      break_end: breakEnd,
      is_active: selectedDays.includes(i)
    }));

    const result = await updateProfessionalAvailability(professionalId, payload);
    
    if (result.success) {
      toast.success(`Agenda de ${professionalName} atualizada com sucesso!`);
    } else {
      toast.error(result.error || "Erro ao salvar agenda.");
    }
    
    setLoading(false);
  }

  return (
    <div className="space-y-8 p-2">
      {/* SELEÇÃO DE DIAS HORIZONTAL */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Dias de Atendimento
        </Label>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <div 
              key={day.id}
              onClick={() => toggleDay(day.id)}
              className={`
                flex flex-col items-center justify-center w-12 h-14 rounded-md border-2 cursor-pointer transition-all
                ${selectedDays.includes(day.id) 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-muted bg-transparent text-muted-foreground hover:border-muted-foreground"}
              `}
            >
              <span className="text-[10px] font-bold uppercase">{day.label}</span>
              <Checkbox 
                checked={selectedDays.includes(day.id)} 
                className="mt-2 pointer-events-none"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* TURNO DE TRABALHO */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Turno de Trabalho
          </Label>
          <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg border">
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-8 text-xs" />
            <span className="text-[10px] text-muted-foreground uppercase">até</span>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        {/* INTERVALO */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
            <Coffee className="h-4 w-4 text-orange-500" /> Intervalo / Almoço
          </Label>
          <div className="flex items-center gap-2 bg-muted/30 p-3 rounded-lg border">
            <Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} className="h-8 text-xs" />
            <span className="text-[10px] text-muted-foreground uppercase">até</span>
            <Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4 border-t">
        <p className="text-[10px] text-muted-foreground italic">
          * Horário aplicado a {selectedDays.length} dias de {professionalName}.
        </p>
        <Button onClick={onSubmit} disabled={loading || selectedDays.length === 0} size="sm">
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sincronizar Agenda
        </Button>
      </div>
    </div>
  );
}