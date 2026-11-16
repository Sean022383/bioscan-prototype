'use strict';

const ServiceInfo = (() => {
  const B = Bioscan;
  const ml = slug => 'https://medlineplus.gov/lab-tests/' + slug + '/';
  const general = ml('how-to-prepare-for-a-lab-test');
  const source = (url, title) => ({ url, title });
  const lab = source(general, 'MedlinePlus: preparing for laboratory tests');
  const note = 'General preparation guidance. Confirm your exact test and instructions with BioScan before your visit. Do not stop or change medicines on your own. Ask the clinic before fasting if you are pregnant, a child, have diabetes, or have fluid restrictions.';
  const descriptions = {
    'Routine Urinalysis': 'Examines urine appearance, chemistry, and microscopic contents.',
    'Pregnancy Test (Urine)': 'Checks a urine sample for the pregnancy hormone hCG.',
    'Routine Stool': 'Examines a stool sample. The clinic will confirm the requested examination and collection method.',
    'Occult Blood': 'Looks for small amounts of blood in stool that may not be visible.',
    'Cotinine': 'Measures a marker of nicotine exposure. Confirm the specimen type with the clinic.',
    'CBC with Platelet': 'Measures red cells, white cells, hemoglobin, hematocrit, and platelets in a blood sample.',
    'HGB & HCT (Manual)': 'Measures hemoglobin and the proportion of red blood cells in blood.',
    'ESR': 'Measures how quickly red blood cells settle; used as a nonspecific inflammation marker.',
    'C.T. & B.T.': 'Clotting-time and bleeding-time investigations. Confirm the method and suitability with the clinic.',
    'Protime': 'Measures how long blood takes to clot through the prothrombin-time test.',
    'PTT': 'Measures clotting time through a different part of the blood-clotting system.',
    'Blood Typing / Rh': 'Identifies ABO blood group and Rh status from a blood sample.',
    'Malarial Smear': 'Microscopic examination of blood for malaria parasites.',
    'Reticulocyte Count': 'Counts young red blood cells to help assess red-cell production.',
    'FBS': 'Measures fasting blood glucose (blood sugar).',
    'BUN': 'Measures blood urea nitrogen, a waste product used in kidney assessment.',
    'Creatinine': 'Measures a waste product used in assessing kidney function.',
    'Uric Acid': 'Measures uric acid in a blood sample.',
    'Cholesterol': 'Measures cholesterol in blood as part of lipid assessment.',
    'Triglyceride': 'Measures triglycerides, a type of fat carried in blood.',
    'HDL / LDL': 'Measures or calculates HDL and LDL cholesterol fractions.',
    'SGOT': 'Measures the AST enzyme in blood; interpreted alongside other clinical information.',
    'SGPT': 'Measures the ALT enzyme in blood, commonly used in liver assessment.',
    'Alkaline Phosphatase': 'Measures ALP, an enzyme associated with the liver, bile ducts, and bones.',
    'Total Protein TP/AG': 'Assesses blood proteins, including albumin and globulin-related measurements.',
    'Bilirubin': 'Measures bilirubin, a substance formed during red-cell breakdown.',
    'Sodium': 'Measures the sodium electrolyte in blood.',
    'Potassium': 'Measures the potassium electrolyte in blood.',
    'Calcium': 'Measures total calcium in blood.',
    'Chloride': 'Measures the chloride electrolyte in blood.',
    'Phosphorus': 'Measures phosphate in blood.',
    'Magnesium': 'Measures magnesium in blood.',
    'HbA1c': 'Estimates average blood glucose over the past two to three months.',
    'Amylase': 'Measures an enzyme involved in carbohydrate digestion.',
    'Lipase': 'Measures an enzyme involved in fat digestion, commonly used in pancreatic assessment.',
    'LDH': 'Measures lactate dehydrogenase, an enzyme found in many body tissues.',
    'CPK': 'Measures creatine kinase, an enzyme associated with muscle tissue.',
    'Ionized Calcium': 'Measures the free, biologically active form of calcium in blood.',
    'Iron': 'Measures circulating iron in blood.',
    'Iron & TIBC': 'Assesses iron and the blood’s capacity to bind and transport it.',
    'OGTT': 'Measures blood glucose before and after a glucose drink, with timed blood collections.',
    'VDRL': 'A blood screening test used in syphilis assessment; additional testing may be needed.',
    'RPR': 'A blood screening test used in syphilis assessment; additional testing may be needed.',
    'Pregnancy (Serum)': 'Checks a blood sample for the pregnancy hormone hCG.',
    'RA Latex': 'Tests for rheumatoid factor; interpreted with symptoms and other investigations.',
    'CRP': 'Measures C-reactive protein, a marker of inflammation.',
    'Widal': 'An antibody investigation used in typhoid assessment. A clinician must interpret its limitations.',
    'Weil-Felix': 'An antibody investigation sometimes used in rickettsial-disease assessment; confirm the ordered method.',
    'HIV 1 & 2': 'Screens for HIV infection. The clinic will explain consent, method, and any follow-up testing.',
    'Typhidot IgM': 'An antibody investigation used in typhoid assessment; results require clinical interpretation.',
    'NS1Ag': 'Checks for dengue NS1 antigen; the timing of symptoms affects test selection.',
    'Semen Analysis': 'Assesses a semen sample, including sperm-related measurements.',
    'Leptospirosis': 'Laboratory investigation for suspected leptospirosis. Confirm the assay and timing with the clinic.',
    'T3': 'Measures triiodothyronine, a thyroid hormone.',
    'T4': 'Measures thyroxine, a thyroid hormone.',
    'TSH': 'Measures thyroid-stimulating hormone.',
    'FT3': 'Measures free triiodothyronine in blood.',
    'FT4': 'Measures free thyroxine in blood.',
    'HBsAg': 'Tests for hepatitis B surface antigen.',
    'Anti-HBs': 'Tests for antibodies against hepatitis B surface antigen.',
    'Anti-HBc IgG': 'Tests for IgG antibodies to hepatitis B core antigen.',
    'Anti-HAV IgM': 'Tests for IgM antibodies to hepatitis A virus.',
    'HBeAg': 'Tests for hepatitis B e antigen.',
    'Anti-HBe': 'Tests for antibodies against hepatitis B e antigen.',
    'Anti-HBc IgM': 'Tests for IgM antibodies to hepatitis B core antigen.',
    'Anti-HAV IgG': 'Tests for IgG antibodies to hepatitis A virus.',
    'Anti-HCV': 'Screens for antibodies to hepatitis C virus; follow-up testing may be required.'
  };
  function get(item) {
    let description = descriptions[item.label] || 'Diagnostic service offered by BioScan. Ask the clinic to confirm the exact examination and specimen.';
    let preparation = 'Confirm whether your ordered test or combination of tests requires fasting, a specific collection time, or special specimen handling. Bring the test request and a list of medicines and supplements.';
    let sources = [lab];
    if (item.category === 'Hematology') preparation = 'Ask about preparation for the exact test. Tell staff about blood thinners, bleeding problems, and medicines; do not stop them without your prescriber’s instructions.';
    if (item.id === 'cbc') {
      preparation = 'A CBC alone usually needs no special preparation. Other tests collected at the same visit may require fasting.';
      sources = [source(ml('complete-blood-count-cbc'), 'MedlinePlus: complete blood count')];
    }
    if (item.id === 'urinalysis') {
      preparation = 'Ask for the clinic’s urine container and collection instructions; a clean-catch sample may be requested. Tell staff if you are menstruating and about medicines or supplements.';
      sources = [source('https://medlineplus.gov/ency/article/003579.htm', 'MedlinePlus: urinalysis')];
    }
    if (item.label.includes('Pregnancy')) {
      preparation = item.label.includes('Urine') ? 'Follow the clinic’s collection instructions. First-morning urine may help with early testing; avoid drinking large amounts of fluid just to produce a sample.' : 'A blood sample is collected. Tell the clinic about fertility medicines and follow its testing instructions.';
      sources = [source(ml('pregnancy-test'), 'MedlinePlus: pregnancy testing')];
    }
    if (item.label === 'Routine Stool' || item.label === 'Occult Blood') {
      preparation = 'Obtain the clinic’s collection container or kit. Keep stool separate from urine and toilet water and follow its return instructions. For occult blood, restrictions depend on whether FIT or a guaiac method is used; confirm the kit before changing diet or medicines.';
      sources = [source(ml('fecal-occult-blood-test-fobt'), 'MedlinePlus: stool blood testing')];
    }
    if (item.id === 'fbs' || item.label === 'OGTT') {
      preparation = item.id === 'fbs' ? 'Fast for at least 8 hours before collection; plain water is allowed. Confirm the clinic’s exact fasting interval.' : 'This test requires fasting and timed samples after a glucose drink, often over 2–3 hours. Arrange the protocol and fasting interval with the clinic before booking.';
      sources = [source(ml('blood-glucose-test'), 'MedlinePlus: blood glucose tests')];
    }
    if (['Cholesterol', 'Triglyceride', 'HDL / LDL'].includes(item.label)) {
      preparation = 'Fasting may be requested for 9–12 hours; some lipid tests are nonfasting. Ask BioScan which applies to your order. If fasting is prescribed, plain water is generally allowed.';
      sources = [source(ml('cholesterol-levels'), 'MedlinePlus: cholesterol testing')];
    }
    if (item.label === 'HbA1c') {
      preparation = 'HbA1c alone does not generally require fasting. Tell staff about medicines and pregnancy; other tests at the same visit may have different preparation.';
      sources = [source(ml('hemoglobin-a1c-hba1c-test'), 'MedlinePlus: HbA1c')];
    }
    if (item.label.startsWith('Iron')) {
      preparation = 'A morning collection and fasting may be requested. Confirm timing with the clinic and tell staff about iron supplements; do not stop medicines on your own.';
      sources = [source('https://medlineplus.gov/ency/article/003488.htm', 'MedlinePlus: serum iron')];
    }
    if (item.label === 'Amylase' || item.label === 'Lipase') {
      preparation = item.label === 'Amylase' ? 'Avoid alcohol for 24 hours. Your provider may request a 2-hour fast for a blood test; confirm the exact instructions.' : 'An 8–12-hour fast may be requested. Confirm the interval and medicine instructions with your provider.';
      sources = [source(ml(item.label === 'Amylase' ? 'amylase-test' : 'lipase-tests'), 'MedlinePlus: ' + item.label.toLowerCase())];
    }
    if (item.category === 'Thyroid Function') {
      preparation = 'Tell your provider about biotin supplements and thyroid medicines before testing; these may affect results or collection timing. Ask for specific instructions rather than stopping treatment yourself.';
      sources = [source('https://medlineplus.gov/ency/article/003444.htm', 'MedlinePlus: thyroid function tests')];
    }
    if (item.label === 'Semen Analysis') {
      preparation = 'Usually avoid ejaculation for 2–7 days beforehand. Use the supplied sterile container without lubricant or saliva. Confirm collection location and delivery timing with the clinic before producing a sample.';
      sources = [source(ml('semen-analysis'), 'MedlinePlus: semen analysis')];
    }
    if (item.category === 'X-ray') {
      description = 'X-ray imaging of the ' + item.label.split(' X-ray')[0].toLowerCase() + ' using the listed view or views.';
      preparation = 'Most plain x-rays need no special preparation. Wear clothing without metal near the area and remove jewelry as directed. Tell staff before imaging if you are or might be pregnant.';
      sources = [source('https://www.radiologyinfo.org/en/info/how-to-prepare-your-x-ray-exam', 'RadiologyInfo: x-ray preparation')];
    }
    if (item.category === 'Ultrasound') {
      description = 'Uses sound waves to image the ' + item.label.replace(' Ultrasound', '').toLowerCase() + ' region, without x-ray radiation.';
      const pelvic = /Lower Abdomen|Pelvic|KUB|Kidneys/.test(item.label);
      const abdomen = /Whole Abdomen|Upper Abdomen|HBT|Liver|Gallbladder|Pancreas|Spleen|Aorta/.test(item.label);
      preparation = abdomen ? 'Abdominal preparation varies by exam; adult protocols may require an 8-hour fast. Confirm BioScan’s food, fluid, and medicine instructions first.' : 'Wear comfortable clothing and confirm the exact scan preparation with the clinic.';
      if (pelvic || item.label.startsWith('Whole')) preparation += ' A full bladder may be needed for the pelvic or urinary part; ask the clinic how much water to drink and when. Follow any fluid restrictions.';
      sources = [source('https://www.radiologyinfo.org/en/info/abdominus', 'RadiologyInfo: abdominal ultrasound'), source('https://www.nebraskamed.com/radiology/for-patients/ultrasound-exam', 'Nebraska Medicine: ultrasound preparation')];
      if (pelvic) sources = [source('https://www.radiologyinfo.org/en/info/pelvus', 'RadiologyInfo: pelvic ultrasound')];
    }
    if (item.category === 'ECG') {
      description = 'Records the electrical activity of your heart using skin electrodes.';
      preparation = 'No special preparation is usually needed for a resting ECG. Tell the provider about medicines and supplements and follow any instructions they give.';
      sources = [source(ml('electrocardiogram'), 'MedlinePlus: electrocardiogram')];
    }
    return { description: item.description || description, preparation: item.preparation || preparation, sources };
  }
  function markup(item, showPrice = true) {
    const info = get(item);
    const heading = '<p>' + B.safe(info.description) + '</p>' + (showPrice ? '<p class="service-price">' + B.money(item.price) + '</p>' : '');
    if (item.serviceIds) {
      const included = item.serviceIds.map(id => B.services().find(s => s.id === id)).filter(Boolean);
      return heading + '<h3>Included services</h3><ul class="bundle-inclusions">' + included.map(s => '<li>' + B.safe(s.label) + '</li>').join('') + '</ul>' +
        '<h3>Before your visit</h3>' + included.map(s => '<p><strong>' + B.safe(s.label) + '</strong><br>' + B.safe(get(s).preparation) + '</p>').join('') + '<p class="quiet">' + B.safe(note) + '</p>';
    }
    return heading + '<h3>Before your visit</h3><p>' + B.safe(info.preparation) + '</p><p class="quiet">' + B.safe(note) + '</p>';
  }
  function selected(ids) {
    const items = B.services().filter(item => B.expandIds(ids).includes(item.id));
    return '<section class="preparation-guide"><h3>Prepare for your selected services</h3><p class="quiet">Read each service’s instructions before confirming. If instructions differ, contact BioScan for a combined preparation plan.</p>' + items.map(item =>
      '<details><summary>' + B.safe(item.label) + '</summary>' + markup(item, false) + '</details>').join('') + '</section>';
  }
  return { get, markup, selected, note };
})();
