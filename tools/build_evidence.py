#!/usr/bin/env python3
"""Evidence photographs for the evolution map: what each conversation changed.

Two sources. Files already prepared for the wiki are copied as they are; files
from the team's own 2026 image bank are scaled to 1400 px and re-encoded.
Nothing is cropped, retouched or otherwise altered.
"""
import subprocess, pathlib, shutil, sys
ROOT = pathlib.Path(__file__).resolve().parents[2]
BANK = ROOT / "iGEM2026_Images"
WIKI = ROOT / "wiki/assets/img"
OUT = pathlib.Path(__file__).resolve().parents[1] / "assets/img/human-practices"

# already web-ready on the wiki: copy
COPY = {
 "ev-cheng-plates":   "plant/o-260327-cheng-plates.webp",
 "ev-cheng-seeds":    "plant/o-260327-seeds.webp",
 "ev-cheng-boxes":    "plant/o-260327-cheng-boxes.webp",
 "ev-verslues-rack":  "plant/o-260404-verslues.webp",
 "ev-float-plate":    "plant/o-260426-float-plate.webp",
 "ev-market-may":     "plant/o-260516-farmers-market.webp",
 "ev-kyle-bench":     "plant/o-260531-kyle.webp",
 "ev-hydro-boxes":    "plant/p-260613-hydroponic-boxes.webp",
 "ev-chen-autofill":  "plant/o-260620-chen-autofill.webp",
 "ev-chbio-wall":     "plant/o-260709-chbiotech.webp",
 "ev-chbio-bottle":   "plant/o-260709-chbiotech-bottle.webp",
 "ev-mschen-soil":    "plant/o-260721-chen-huiwen-soil.webp",
 "ev-hydro-dead":     "plant/p-260723-hydroponic-postmortem.webp",
 "ev-yuanxian-wall":  "plant/o-260811-yuanxian-wall.webp",
 "ev-yuanxian-plate": "plant/o-260811-yuanxian-plate.webp",
 "ev-cad-redesign":   "plant/o-260811-cad-redesign.webp",
 "ev-soil-pots":      "plant/p-260822-soil-pots.webp",
 "ev-electroporation":"engineering/lab-260517-electroporation.webp",
 "ev-vertical-wrong": "plant/p-260617-wrong-orientation.webp",
 "ev-contamination":  "plant/p-260617-contamination.webp",
 "ev-heat-panel":     "plant/fig-heat-day4-panel.webp",
 "ev-scoring-bench":  "plant/p-260822-scoring-bench.webp",
 "ev-growth-chamber": "plant/p-260829-growth-chamber.webp",
 "ev-gel-accd":       "engineering/gel-260722-level1-accd.webp",
 "ev-gel-acdi":       "engineering/gel-260901-level2-acdi-junctions.webp",
 "ev-gel-lea":        "engineering/gel-260725-level1-lea.webp",
}
COPY_RAW = {   # jpg/png on the wiki, re-encoded below
 "ev-pressure-live":  "software/first-live-pressure-20260712.jpg",
 "ev-reactor-run":    "software/reactor-running-20260720.jpg",
 "ev-od600-live":     "software/od600-live-monitor-20260803.jpg",
}
# the team's image bank: scale and re-encode
BANKMAP = {
 "ev-pivot-doc":      "2026-04/General/W19  4_12-4_19/20260415_General_Figure_ProjectPivot_Illustration.png",
 "ev-hollow-fibre":   "2026-04/Drylab/W20  4_19-4_26/20260425_Drylab_Photo_HollowFiberMembraneDesign.jpg",
 "ev-first-agar":     "2026-04/Wetlab/W19  4_12-4_19/20260412_Wetlab_Photo_1stAgarArabidopsisPlanting.png",
 "ev-expo-interview": "2026-05/HP/W23  5_10-5_17/20260516_HP_Photo_花博農民市集_農夫interview.jpg",
 "ev-worldveg-meet":  "2026-05/HP/W25  5_24-5_31/20260525_HP_Photo_OnlineMeetingWithWorldVegeCenter.png",
 "ev-chang-visit":    "2026-06/General/W28  6_14-6_21/20260618_General_Photo_ProfChang_BioreactorImportantDiscussion_Suggestion2.jpg",
 "ev-chen-reactor":   "2026-06/HP/W28  6_14-6_21/20260620_HP_Photo_ProfChen陳文亮_Bioreactor_Great.jpg",
 "ev-chen-model":     "2026-06/HP/W28  6_14-6_21/20260620_HP_Photo_ProfChen陳文亮_MathModeling_Great.jpg",
 "ev-line-prototype": "2026-07/HP/W31  7_5-7_12/20260711_HP_Photo_SmartFarmerLinePlatformPrototypeInterface.png",
 "ev-chbio-rules":    "2026-07/HP/W31  7_5-7_12/20260709_HP_Photo_正瀚Outreach_RegulationExpertFromCHbiotechPresentingRegulationStructures.png",
 "ev-bioasia-booth":  "2026-07/HP/W32  7_12-7_19/20260718_HP_Photo_ExpoBioAsiaTaiwanGroupLearningFromBioreactorHollowFiberMembraneSetupGreatPhoto.jpg",
 "ev-seed-platform":  "2026-07/HP/W33  7_19-7_26/20260723_HP_Photo_StudentSharingIdeasHeardFromFarmerChenOfSeedTradingAndStudentsSharingAPrototypeOfSeedTradingPlatform.jpg",
 "ev-hay-infusion":   "2026-08/HP/W35  8_2-8_9/20260803_HP_Photo_HayInfusionBottleWithYellowHayInIt.jpg",
 "ev-do-sensors":     "2026-08/Drylab/W35  8_2-8_9/20260805_Drylab_Photo_TestingOutPHAndDissolvedOxygenSensors.jpg",
 "ev-nchu-visit":     "2026-08/HP/W35  8_2-8_9/20260806_HP_Photo_Outreach_NCHU黃介成_ProfessorShowingStudentsAroundTheMuseumInLifeScienceDepartment_GreatPhoto.jpg",
 "ev-wb800-plate":    "2026-08/HP/W35  8_2-8_9/20260806_HP_Photo_Outreach_NCHU黃介成_TopDownViewOfTheBsubWB800PlateWeGotFromProfessor.jpg",
 "ev-huangzb-group":  "2026-08/HP/W35  8_2-8_9/20260806_HP_Photo_Outreach_NCHU黃介成_With黃姿碧ProfessorGroupPhoto.jpg",
 "ev-pinch-valve":    "2026-08/Drylab/W35  8_2-8_9/20260807_Drylab_Photo_StudentsTestingOutThePinchValvePrintedMaterials.jpg",
 "ev-math-sketch":    "2026-08/Drylab/W36  8-9-8-16/20260815_Drylab_Figure_ASketchOfTheOverviewOfOurMathModel4PartsFromLeftToRightGraphicalIllustrationsOnTopAndMathDown.png",
 "ev-reactor-case":   "2026-08/Drylab/W37  8-16-8-23/20260823_Photo_BioreactorInComputerCaseBuilding3.jpg",
 "ev-yuanxian-cad":   "2026-08/Drylab/W36  8-9-8-16/20260811_Drylab_Photo_Outreach_源先智慧農場_DrylabStudentsChangingDesignsOfHardwareOnComputerCADMeasuringMetrics.png",
 "ev-forum-prep":     "2026-08/HP/W38  8_23-8_30/20260829_HP_Photo_Presentation prep.jpg",
 "ev-vertical-start": "20260616_Wetlab_Photo_StartOfVerticalAgarPlate.jpg",
 "ev-averra-poster":  "20260410_HP_Figure_AVERRA2025iGEMstartupposter_陳文亮Meetingmentioned_ProjectPivot.jpg",
 "ev-first-hardware": "20260418_Drylab_Figure_1stHardwareDesign.jpg",
 "ev-lab-safety":     "20260822_Wetlab_Photo_LabSafetyBSC.jpg",
 "ev-kyle-inspect":   "20260531_Wetlab_Photo_Instructor_PlantPhDAdvisor_Kyle_LabInspection.jpg",
 "ev-chang-visit2":   "20260618_General_Photo_ProfChang_BioreactorImportantDiscussion_Suggestion_Imporatnt2.jpg",
 "ev-plant-transplant": "20260804_Wetlab_Photo_LabWorkStudentVeryFocusedOnPlantTransplanting_GreatPhoto.jpg",
 "ev-plate-inspect":  "20260822_Wetlab_Photo_StudentsInspectingPlate.jpg",
 "ev-chbio-group":    "20260709_HP_Photo_正瀚Outreach_GroupPhotoWithResearcher.jpg",
 "ev-bioasia-reactor":"20260718_HP_Photo_ExpoBioAsiaTaiwanBoothWithCoolBioreactorSetup.jpg",
 "ev-nchu-gate":      "20260806_HP_Photo_Outreach_NCHU黃介成_GroupPhotoAtDepartmentGate.jpg",
 "ev-nchu-office":    "20260806_HP_Photo_Outreach_NCHU黃介成_GroupPhotoInProfessorsOffice.jpg",
 "ev-reactor-assembly": "20260829_bioreactor_assembly_4.jpg",
 "ev-reactor-case2":  "20260823_Photo_BioreactorInComputerCaseBuilding6.jpg",
}
SYMP = ROOT / "wiki/human-practices/Pictures /Expert Engagement/9:11 poster symposium photo"
EXTRA = {
 "ev-symp-rehearsal": SYMP / "PosterPic1.jpg",
 "ev-symp-poster":    SYMP / "PosterPic2.jpg",
 "ev-symp-explain":   SYMP / "PosterPic3.jpg",
 "ev-symp-award":     SYMP / "PosterPic4.png",
}
def encode(src, slug, width=1400, q=80):
    tmp = OUT / (slug + ".tmp.png")
    subprocess.run(["magick", str(src), "-auto-orient", "-resize", "%dx%d>" % (width, width),
                    "-strip", str(tmp)], check=True)
    subprocess.run(["cwebp", "-quiet", "-q", str(q), str(tmp), "-o", str(OUT / (slug + ".webp"))], check=True)
    tmp.unlink()

missing = []
for slug, rel in COPY.items():
    src = WIKI / rel
    if src.exists(): shutil.copyfile(src, OUT / (slug + ".webp"))
    else: missing.append(rel)
for slug, rel in COPY_RAW.items():
    src = WIKI / rel
    if src.exists(): encode(src, slug)
    else: missing.append(rel)
def find(rel):
    direct = BANK / rel
    if direct.exists():
        return direct
    hits = list(BANK.rglob(pathlib.Path(rel).name))
    return hits[0] if hits else None

for slug, rel in BANKMAP.items():
    if (OUT / (slug + ".webp")).exists():
        continue
    src = find(rel)
    if src: encode(src, slug)
    else: missing.append(rel)
for slug, src in EXTRA.items():
    if (OUT / (slug + ".webp")).exists():
        continue
    if src.exists(): encode(src, slug)
    else: missing.append(str(src))
if missing:
    print("MISSING:", *missing, sep="\n  ", file=sys.stderr)
print("evidence done")
