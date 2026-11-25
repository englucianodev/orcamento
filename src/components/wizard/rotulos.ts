/** Rótulos em português das opções do assistente (valores = enums do schema da entrada). */
export type Opcoes = ReadonlyArray<readonly [string, string]>;

export const R = {
  padrao: [["baixo", "Baixo"], ["normal", "Normal"], ["alto", "Alto"], ["luxo", "Luxo"]],
  topografia: [["plano", "Plano"], ["aclive", "Aclive"], ["declive", "Declive"]],
  solo: [["misto", "Misto / não sei"], ["argiloso", "Argiloso"], ["arenoso", "Arenoso"], ["siltoso", "Siltoso"], ["rochoso", "Rochoso"]],
  vegetacao: [["leve", "Leve"], ["media", "Média"], ["densa", "Densa"]],
  portao: [["deslizante", "Deslizante"], ["basculante", "Basculante"], ["pivotante", "Pivotante"], ["abrir", "De abrir"]],
  estrutura: [["concreto_armado", "Concreto armado"], ["alvenaria_estrutural", "Alvenaria estrutural"], ["metalica", "Metálica"]],
  fundacao: [["automatico", "Automática (pelo solo e pavimentos)"], ["sapata", "Sapata"], ["radier", "Radier"], ["estaca_broca", "Estaca broca"], ["helice_continua", "Hélice contínua"]],
  laje: [["trelicada", "Treliçada"], ["macica", "Maciça"], ["sem_laje", "Sem laje"]],
  vedacao: [["bloco_ceramico", "Bloco cerâmico"], ["bloco_concreto", "Bloco de concreto"], ["drywall", "Drywall"]],
  telha: [["ceramica", "Cerâmica"], ["concreto", "Concreto"], ["fibrocimento", "Fibrocimento"], ["metalica", "Metálica"], ["termoacustica", "Termoacústica"], ["shingle", "Shingle"], ["laje_impermeabilizada", "Laje impermeabilizada"]],
  aguas: [["1", "1 água"], ["2", "2 águas"], ["4", "4 águas"]],
  estruturaCobertura: [["madeira", "Madeira"], ["metalica", "Metálica"]],
  aguaQuente: [["eletrica", "Elétrica (chuveiro)"], ["gas", "Gás"], ["solar", "Solar"], ["nenhuma", "Nenhuma"]],
  esgoto: [["rede_publica", "Rede pública"], ["fossa_sumidouro", "Fossa e sumidouro"]],
  piscina: [["concreto_armado", "Concreto armado"], ["alvenaria", "Alvenaria"], ["vinil", "Vinil"], ["fibra", "Fibra"]],
  aquecimentoPiscina: [["nenhum", "Nenhum"], ["solar", "Solar"], ["bomba_calor", "Bomba de calor"], ["gas", "Gás"]],
  churrasqueira: [["nenhuma", "Nenhuma"], ["alvenaria", "Alvenaria"], ["pre_moldada", "Pré-moldada"], ["gas", "A gás"]],
  tipoAmbiente: [
    ["quarto", "Quarto"], ["suite", "Suíte"], ["closet", "Closet"], ["sala_estar", "Sala de estar"], ["sala_jantar", "Sala de jantar"],
    ["cozinha", "Cozinha"], ["copa", "Copa"], ["banheiro", "Banheiro"], ["lavabo", "Lavabo"], ["area_servico", "Área de serviço"],
    ["despensa", "Despensa"], ["escritorio", "Escritório"], ["circulacao", "Circulação"], ["escada", "Escada"], ["garagem", "Garagem"],
    ["varanda", "Varanda"], ["area_gourmet", "Área gourmet"], ["home_theater", "Home theater"], ["adega", "Adega"], ["deposito", "Depósito"], ["outro", "Outro"],
  ],
  paredes: [["todas", "Todas as paredes"], ["parcial", "Parcial (%)"], ["nenhuma", "Sem paredes"]],
  molhada: [["", "Automático pelo tipo"], ["true", "Sim"], ["false", "Não"]],
  piso: [
    ["ceramica_pei4", "Cerâmica PEI-4"], ["porcelanato_60x60", "Porcelanato 60×60"], ["porcelanato_90x90", "Porcelanato 90×90"],
    ["porcelanato_grande_formato", "Porcelanato grande formato"], ["marmore", "Mármore"], ["laminado", "Laminado"], ["vinilico", "Vinílico"],
    ["cimentado", "Cimentado"], ["deck_madeira", "Deck de madeira"], ["nenhum", "Nenhum"],
  ],
  revestimento: [["nenhum", "Nenhum"], ["ceramica", "Cerâmica"], ["porcelanato", "Porcelanato"]],
  forro: [["sem_forro", "Sem forro"], ["pvc", "PVC"], ["gesso_placa", "Gesso em placa"], ["gesso_drywall", "Gesso drywall"], ["madeira", "Madeira"]],
  pintura: [["latex_pva", "Látex PVA"], ["acrilica_massa_pva", "Acrílica + massa PVA"], ["acrilica_massa_acrilica", "Acrílica + massa acrílica"], ["acrilica_premium", "Acrílica premium"], ["nenhuma", "Nenhuma"]],
  tipoVao: [["porta", "Porta"], ["janela", "Janela"]],
  materialPorta: [["madeira_semioca", "Madeira semioca"], ["madeira_kit_pronta", "Kit porta pronta"], ["madeira_macica", "Madeira maciça"], ["aluminio", "Alumínio"], ["vidro_temperado", "Vidro temperado"], ["pvc", "PVC"]],
  materialJanela: [["aluminio", "Alumínio"], ["aluminio_linha_25", "Alumínio linha 25"], ["aluminio_linha_gold", "Alumínio linha Gold"], ["pvc", "PVC"], ["madeira", "Madeira"], ["vidro_temperado", "Vidro temperado"], ["sob_medida_vidro_duplo", "Sob medida, vidro duplo"]],
} as const satisfies Record<string, Opcoes>;

export function rotulo(opcoes: Opcoes, valor: string | null | undefined): string {
  return opcoes.find(([v]) => v === valor)?.[1] ?? String(valor ?? "—");
}
