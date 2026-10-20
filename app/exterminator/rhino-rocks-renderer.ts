import type { Game } from "./game";
import { warningLit } from "./lighting";
import { RHINO_ROCK, rhinoRocks, solidRock } from "./rhino-rocks";

export function drawRhinoRocks(ctx: CanvasRenderingContext2D, game: Game) {
	ctx.save();
	for (const rock of rhinoRocks(game.boss)) {
		if (rock.health <= 0) continue;
		const solid = solidRock(rock), progress = Math.max(0, 1 - rock.remaining / RHINO_ROCK.warning);
		if (!solid && warningLit(game, rock)) {
			ctx.strokeStyle = "#efb17c"; ctx.fillStyle = "#db794b22"; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(rock.x, rock.y, RHINO_ROCK.blast, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
			ctx.beginPath(); ctx.moveTo(rock.x - 9, rock.y - 9); ctx.lineTo(rock.x + 9, rock.y + 9); ctx.moveTo(rock.x + 9, rock.y - 9); ctx.lineTo(rock.x - 9, rock.y + 9); ctx.stroke();
		}
		ctx.fillStyle = `rgba(5,10,9,${solid ? .55 : .1 + progress * .35})`;
		ctx.beginPath(); ctx.ellipse(rock.x, rock.y + 6, 32, 21, 0, 0, Math.PI * 2); ctx.fill();
		const height = solid ? 0 : (1 - progress * progress) * 210;
		ctx.save(); ctx.translate(rock.x, rock.y - height);
		const flash = game.time - rock.hitAt < .1;
		ctx.fillStyle = flash ? "#ddd8ba" : "#5c6154"; ctx.strokeStyle = "#292e28"; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(-29, 9); ctx.lineTo(-23, -16); ctx.lineTo(-8, -31); ctx.lineTo(17, -27); ctx.lineTo(29, -7); ctx.lineTo(26, 17); ctx.lineTo(5, 26); ctx.lineTo(-21, 23); ctx.closePath(); ctx.fill(); ctx.stroke();
		ctx.fillStyle = flash ? "#f4ebcf" : "#92917a";
		ctx.beginPath(); ctx.moveTo(-23, -16); ctx.lineTo(-8, -31); ctx.lineTo(17, -27); ctx.lineTo(5, -3); ctx.lineTo(-9, 3); ctx.closePath(); ctx.fill();
		ctx.fillStyle = "#3b443b"; ctx.beginPath(); ctx.moveTo(5, -3); ctx.lineTo(29, -7); ctx.lineTo(26, 17); ctx.lineTo(5, 26); ctx.closePath(); ctx.fill();
		if (rock.health < RHINO_ROCK.health) {
			ctx.strokeStyle = "#202b24"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-8, -24); ctx.lineTo(-2, -8); ctx.lineTo(-12, 4); ctx.lineTo(0, 12); ctx.lineTo(-3, 23); ctx.stroke();
		}
		ctx.restore();
		const age = game.time - rock.landedAt;
		if (solid && age < .35) { ctx.strokeStyle = `rgba(206,184,143,${1 - age / .35})`; ctx.lineWidth = 4 * (1 - age / .35); ctx.beginPath(); ctx.arc(rock.x, rock.y, RHINO_ROCK.blast * Math.min(1, age / .18), 0, Math.PI * 2); ctx.stroke(); }
	}
	ctx.restore();
}
