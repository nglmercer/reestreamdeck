import React , { useState } from "react";
import DynamicModal from "./components/DynamicModal";
import datajson from "./assets/datajson/keyboard.json";
import socketManager from "./utils/socket";

const Modalconfig = ({ onSave }) => {
  const options = Object.entries(datajson).map(([value, label]) => ({
    value,
    label,
  }));
  const [apps, setApps] = useState([]);
  socketManager.onMessage("getapps", (getapps) => {
    console.log("apps", getapps);
    setApps(getapps);
  });
  const appsOptions = apps.map((app) => ({
    value: app.path,
    label: app.name,
  }));
  console.log("appsOptions", appsOptions);
  const formConfig = [
    {
      database: "myCustomDatabase",
      objectStore: "customFormData",
    },
    {
      type: "input",
      name: "nombre",
      label: "nombre",
      inputType: "text",
    },
    {
      type: "colorPicker",
      name: "color",
      label: "color",
    },
    {
      type: "multiSelect",
      name: "keyvalue",
      label: "keyvalue",
      options: options,
    },
    {
      type: "select",
      name: "application",
      label: "application",
      options: appsOptions,
    },
    {
      type: "select",
      name: "actionType",
      label: "Tipo de Acción",
      options: [
        { value: "keyPress", label: "Presionar Tecla", name: "keyvalue" },
        { value: "openApp", label: "Abrir Aplicación", name: "application" },
      ],
    },
  ];

  // console.log("apps", apps);
  const handleSave = (data) => {
    console.log("Data saved to IndexedDB and retrieved:", data);
    onSave(); // Notifica a Gridcontent que se ha guardado la información
  };

  return (
    <div>
      <DynamicModal config={formConfig} onSave={handleSave} />
    </div>
  );
};

export default Modalconfig;
